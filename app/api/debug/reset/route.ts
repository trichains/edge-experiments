import { NextResponse, type NextRequest } from "next/server";
import { ASSIGNMENTS_COOKIE, VISITOR_COOKIE } from "@/lib/core/constants";

const FALLBACK = "/demo/landing";

/**
 * Resolves `next` against the request URL and only accepts same-origin targets. Anything that
 * resolves to another origin (`//evil.com`, `/\evil.com`, `https://evil.com`) falls back to the demo page.
 */
function safeRedirectTarget(next: string | null, requestUrl: string): URL {
  const base = new URL(requestUrl);
  if (!next) return new URL(FALLBACK, base);
  try {
    const target = new URL(next, base);
    return target.origin === base.origin ? target : new URL(FALLBACK, base);
  } catch {
    return new URL(FALLBACK, base);
  }
}

/**
 * Dev aid behind the "switch variant" link: forgets the visitor id and the assignments, then
 * redirects back. Bucketing is deterministic per visitor id, so the id has to go too; the next
 * request gets a fresh id and may land in a different variant.
 */
export function GET(request: NextRequest) {
  const target = safeRedirectTarget(request.nextUrl.searchParams.get("next"), request.url);
  const response = NextResponse.redirect(target, 303);
  response.cookies.delete(VISITOR_COOKIE);
  response.cookies.delete(ASSIGNMENTS_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
