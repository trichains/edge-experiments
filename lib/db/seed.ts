import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { events, experiments, flags } from "./schema";
import { experimentFixtures, flagFixtures, seededTraffic } from "./fixtures";
import { assignVariant } from "../core/bucketing";
import type { ExperimentDefinition } from "../core/types";

/** Small deterministic PRNG (mulberry32) so seeded data is identical on every cold start. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type EventInsert = typeof events.$inferInsert;

/**
 * Builds synthetic exposure + conversion rows using the real bucketing code.
 * - `exact`: conversions per variant = round(exposed * rate), for stable fixtures.
 * - otherwise each visitor converts with probability `rate` (used by "Simulate traffic").
 */
export function syntheticEvents(
  experiment: Pick<ExperimentDefinition, "key" | "trafficAllocation" | "variants" | "primaryGoal">,
  opts: { visitors: number; rates: Record<string, number>; random: () => number; exact?: boolean; idPrefix: string; since?: Date; until?: Date },
): EventInsert[] {
  const byVariant = new Map<string, string[]>();
  for (let i = 0; i < opts.visitors; i++) {
    const vid = `${opts.idPrefix}-${Math.floor(opts.random() * 2 ** 32).toString(36)}-${i.toString(36)}`;
    // Traffic allocation is ignored for synthetic visitors: they represent enrolled traffic.
    const variant = assignVariant(vid, { ...experiment, trafficAllocation: 100 });
    if (!variant) continue;
    const list = byVariant.get(variant) ?? [];
    list.push(vid);
    byVariant.set(variant, list);
  }

  const span = opts.since && opts.until ? opts.until.getTime() - opts.since.getTime() : 0;
  const at = () => (opts.since && span > 0 ? new Date(opts.since.getTime() + opts.random() * span) : new Date());
  const rows: EventInsert[] = [];
  for (const [variant, vids] of byVariant) {
    const rate = Math.min(1, Math.max(0, opts.rates[variant] ?? 0));
    const target = Math.round(vids.length * rate);
    vids.forEach((vid, index) => {
      const exposedAt = at();
      rows.push({ experimentKey: experiment.key, variant, visitorId: vid, kind: "exposure", goal: "", synthetic: true, createdAt: exposedAt });
      const converts = opts.exact ? index < target : opts.random() < rate;
      if (converts) {
        rows.push({
          experimentKey: experiment.key,
          variant,
          visitorId: vid,
          kind: "conversion",
          goal: experiment.primaryGoal,
          synthetic: true,
          createdAt: new Date(exposedAt.getTime() + Math.floor(opts.random() * 600_000)),
        });
      }
    });
  }
  return rows;
}

export async function insertEvents(db: Db, rows: EventInsert[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    const result = await db.insert(events).values(chunk).onConflictDoNothing().returning({ id: events.id });
    inserted += result.length;
  }
  return inserted;
}

export async function seedIfEmpty(db: Db): Promise<boolean> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(experiments);
  if (count > 0) return false;

  const now = new Date();
  const fixtures = experimentFixtures(now);
  await db.insert(experiments).values(fixtures);
  await db.insert(flags).values(flagFixtures);

  for (const exp of fixtures) {
    const traffic = seededTraffic[exp.key];
    if (!traffic) continue;
    const rows = syntheticEvents(exp, {
      ...traffic,
      exact: true,
      random: mulberry32(exp.key.length * 7919),
      idPrefix: `seed-${exp.key}`,
      since: exp.startedAt ?? now,
      until: exp.endedAt ?? now,
    });
    await insertEvents(db, rows);
  }
  return true;
}
