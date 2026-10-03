import type { NextRequest } from "next/server";
import { ASSIGNMENTS_COOKIE, VISITOR_COOKIE, VISITOR_ID_PATTERN } from "@/lib/core/constants";
import { decodeAssignments } from "@/lib/core/cookie-format";
import { trackPayloadSchema } from "@/lib/core/types";
import { log } from "@/lib/log";
import { getEdgeConfig, recordEvents, type NewEvent } from "@/lib/server/repo";

const MAX_BODY_BYTES = 4096;

/**
 * Beacon endpoint used by the client SDK (`navigator.sendBeacon`), so the body arrives as text/plain.
 * Identity and assignments come from the first-party cookies, never from the body: the body only says
 * *what* happened (exposure of experiments X/Y, or conversion on goal Z).
 * Duplicate events are ignored by the database unique index, so counts are unique visitors.
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large" }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = trackPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }

  const visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? "";
  if (!VISITOR_ID_PATTERN.test(visitorId)) {
    return Response.json({ error: "missing_visitor" }, { status: 400 });
  }
  const assignments = decodeAssignments(request.cookies.get(ASSIGNMENTS_COOKIE)?.value);
  const config = await getEdgeConfig();
  const running = config.experiments.filter((e) => e.status === "running");

  const rows: NewEvent[] = [];
  const payload = parsed.data;
  for (const exp of running) {
    const variant = assignments[exp.key];
    if (!variant || !exp.variants.some((v) => v.key === variant)) continue;
    if (payload.type === "exposure" && payload.experiments.includes(exp.key)) {
      rows.push({ experimentKey: exp.key, variant, visitorId, kind: "exposure" });
    }
    if (payload.type === "conversion" && payload.goal === exp.primaryGoal) {
      rows.push({ experimentKey: exp.key, variant, visitorId, kind: "conversion", goal: payload.goal, props: payload.props });
    }
  }

  const recorded = await recordEvents(rows);
  log.info("track", {
    requestId,
    type: payload.type,
    goal: payload.type === "conversion" ? payload.goal : undefined,
    matched: rows.length,
    recorded,
    duplicates: rows.length - recorded,
  });
  return Response.json({ recorded, matched: rows.length }, { status: 202 });
}
