import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { isSandbox } from "@/lib/env";
import { insertEvents, syntheticEvents } from "@/lib/db/seed";
import { log } from "@/lib/log";
import { isAuthorized, unauthorized } from "@/lib/server/admin";
import { countSimulatedExposures, getExperiment, toDefinition } from "@/lib/server/repo";

/** Per-call cap. */
const MAX_SIMULATED_PER_CALL = 5_000;
/** Total simulated exposures kept per experiment, so the public demo can't be used to fill memory. */
const MAX_SIMULATED_PER_EXPERIMENT = 100_000;

const bodySchema = z.object({
  experimentKey: z.string().min(1),
  visitors: z.number().int().min(10).max(MAX_SIMULATED_PER_CALL),
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

  const existing = await countSimulatedExposures(row.key);
  if (existing + parsed.data.visitors > MAX_SIMULATED_PER_EXPERIMENT) {
    return Response.json(
      {
        error: "simulation_limit",
        hint: `at most ${MAX_SIMULATED_PER_EXPERIMENT} simulated visitors per experiment; the sandbox resets on the next cold start`,
        existing,
      },
      { status: 409 },
    );
  }

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
