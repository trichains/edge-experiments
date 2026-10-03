import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { isSandbox } from "@/lib/env";
import { insertEvents, syntheticEvents } from "@/lib/db/seed";
import { log } from "@/lib/log";
import { isAuthorized, unauthorized } from "@/lib/server/admin";
import { getExperiment, toDefinition } from "@/lib/server/repo";

const bodySchema = z.object({
  experimentKey: z.string().min(1),
  visitors: z.number().int().min(10).max(20_000),
  /** True conversion rate per variant key, 0-1. */
  rates: z.record(z.string(), z.number().min(0).max(1)),
});

/**
 * Sandbox-only: generates synthetic visitors so the stats page has something to show.
 * Visitors are bucketed by the same hash as real traffic; each converts with its variant's true rate.
 * Refused when DATABASE_URL is set, so it can never pollute a real database.
 */
export async function POST(request: Request) {
  if (!isSandbox()) return Response.json({ error: "sandbox_only" }, { status: 403 });
  if (!isAuthorized(request)) return unauthorized();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const row = await getExperiment(parsed.data.experimentKey);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  const experiment = toDefinition(row);
  const rows = syntheticEvents(experiment, {
    visitors: parsed.data.visitors,
    rates: parsed.data.rates,
    random: Math.random,
    idPrefix: `sim-${Date.now().toString(36)}`,
  });
  const inserted = await insertEvents(await getDb(), rows);
  const exposures = rows.filter((r) => r.kind === "exposure").length;
  log.info("simulate", { experiment: experiment.key, visitors: parsed.data.visitors, inserted });
  return Response.json({ visitors: exposures, conversions: rows.length - exposures, inserted });
}
