import { NextResponse, type NextRequest } from "next/server";
import {
  ASSIGNMENTS_COOKIE,
  EXPERIMENTS_HEADER,
  FLAGS_HEADER,
  ONE_YEAR_SECONDS,
  VISITOR_COOKIE,
  VISITOR_HEADER,
  VISITOR_ID_PATTERN,
} from "./lib/core/constants";
import { decodeAssignments, encodeAssignments, encodeFlags } from "./lib/core/cookie-format";
import { directVariantHit, evaluate } from "./lib/core/evaluate";
import { buildRequestContext } from "./lib/core/targeting";
import { edgeConfigSchema, type EdgeConfig } from "./lib/core/types";

/*
 * Runs before every page render. Imports only from lib/core (pure TS, Web APIs only): no database
 * driver, no Node built-ins. The config comes from GET /api/config over HTTP.
 */

const CONFIG_TTL_MS = 30_000;
/** Short timeout when a stale copy can be served; longer on a cold instance with nothing to fall back to. */
const CONFIG_TIMEOUT_MS = 1_500;
const COLD_CONFIG_TIMEOUT_MS = 8_000;

// Best-effort per-instance memo. The docs warn that proxy globals are not shared or durable, so this
// is only an optimisation on top of the CDN cache that /api/config's Cache-Control enables.
let memo: { config: EdgeConfig; fetchedAt: number } | null = null;
/** Concurrent requests on a cold or expired instance share one fetch. */
let inflight: Promise<EdgeConfig | null> | null = null;
/** After a failed fetch, don't retry on every request for a few seconds. */
const FAILURE_BACKOFF_MS = 5_000;
let failedAt = 0;

async function fetchConfig(origin: string): Promise<EdgeConfig | null> {
  try {
    const res = await fetch(new URL("/api/config", origin), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(memo ? CONFIG_TIMEOUT_MS : COLD_CONFIG_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const config = edgeConfigSchema.parse(await res.json());
    memo = { config, fetchedAt: Date.now() };
    failedAt = 0;
    return config;
  } catch (error) {
    failedAt = Date.now();
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", event: "proxy.config_unavailable", error: String(error) }));
    // Serve the last known config if we have one; otherwise pages render their control experience.
    return memo?.config ?? null;
  }
}

async function loadConfig(origin: string): Promise<EdgeConfig | null> {
  if (memo && Date.now() - memo.fetchedAt < CONFIG_TTL_MS) return memo.config;
  if (failedAt && Date.now() - failedAt < FAILURE_BACKOFF_MS) return memo?.config ?? null;
  inflight ??= fetchConfig(origin).finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl;

  // Never trust these from the client.
  const forwarded = new Headers(request.headers);
  forwarded.delete(EXPERIMENTS_HEADER);
  forwarded.delete(FLAGS_HEADER);
  forwarded.delete(VISITOR_HEADER);

  const config = await loadConfig(origin);
  if (!config) return NextResponse.next({ request: { headers: forwarded } });

  // Variant routes are rewrite targets; visiting one directly would show a variant the visitor is
  // not counted in, so send them to the experiment's public path instead.
  const direct = directVariantHit(config, pathname);
  if (direct) return NextResponse.redirect(new URL(direct.path + request.nextUrl.search, request.url), 307);

  const existingId = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = existingId && VISITOR_ID_PATTERN.test(existingId) ? existingId : crypto.randomUUID();
  const isNewVisitor = visitorId !== existingId;

  const existing = decodeAssignments(request.cookies.get(ASSIGNMENTS_COOKIE)?.value);
  const ctx = buildRequestContext({ searchParams, headers: request.headers });
  const result = evaluate(config, visitorId, existing, ctx, pathname);

  forwarded.set(VISITOR_HEADER, visitorId);
  forwarded.set(EXPERIMENTS_HEADER, encodeAssignments(result.active));
  forwarded.set(FLAGS_HEADER, encodeFlags(result.flags));

  const response = result.rewrite
    ? NextResponse.rewrite(new URL(`${result.rewrite.experiment.path}/${result.rewrite.variant}${request.nextUrl.search}`, request.url), {
        request: { headers: forwarded },
      })
    : NextResponse.next({ request: { headers: forwarded } });

  const cookieOptions = {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax" as const,
    // Readable by the client SDK on purpose: it only holds an anonymous id and variant keys.
    httpOnly: false,
    secure: request.nextUrl.protocol === "https:",
  };
  if (isNewVisitor) response.cookies.set(VISITOR_COOKIE, visitorId, cookieOptions);
  if (result.changed || isNewVisitor) {
    const encoded = encodeAssignments(result.cookieAssignments);
    if (encoded) response.cookies.set(ASSIGNMENTS_COOKIE, encoded, cookieOptions);
    else if (request.cookies.has(ASSIGNMENTS_COOKIE)) response.cookies.delete(ASSIGNMENTS_COOKIE);
  }
  // Personalised responses (and anything setting cookies) must not be stored by shared caches.
  if (result.rewrite || isNewVisitor || result.changed) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip /api/* routes, Next internals and files with an extension.
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
