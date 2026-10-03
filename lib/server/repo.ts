import { and, asc, eq, gte, like, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../db/client";
import { events, experiments, flags, type ExperimentRow, type FlagRow } from "../db/schema";
import { fnv1a32 } from "../core/hash";
import {
  edgeConfigSchema,
  type EdgeConfig,
  type ExperimentDefinition,
  type ExperimentStatus,
  type FlagDefinition,
} from "../core/types";
import type { VariantCounts } from "../core/stats";

export function toDefinition(row: ExperimentRow): ExperimentDefinition {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    status: row.status,
    trafficAllocation: row.trafficAllocation,
    variants: row.variants,
    targeting: row.targeting ?? {},
    mode: row.mode,
    path: row.path,
    primaryGoal: row.primaryGoal,
  };
}

export function toFlag(row: FlagRow): FlagDefinition {
  return { key: row.key, description: row.description, enabled: row.enabled, rollout: row.rollout, killSwitch: row.killSwitch };
}

/**
 * Everything the proxy needs, and nothing else: running + paused experiments (paused ones so the
 * proxy keeps their cookie entries) and all flags. Validated before it leaves the server.
 */
export async function getEdgeConfig(): Promise<EdgeConfig> {
  const db = await getDb();
  const [expRows, flagRows] = await Promise.all([
    db.select().from(experiments).where(sql`${experiments.status} in ('running', 'paused')`).orderBy(asc(experiments.key)),
    db.select().from(flags).orderBy(asc(flags.key)),
  ]);
  const body = { experiments: expRows.map(toDefinition), flags: flagRows.map(toFlag) };
  const version = fnv1a32(JSON.stringify(body)).toString(16).padStart(8, "0");
  return edgeConfigSchema.parse({ version, generatedAt: new Date().toISOString(), ...body });
}

export async function listExperiments(): Promise<ExperimentRow[]> {
  const db = await getDb();
  return db.select().from(experiments).orderBy(asc(experiments.createdAt), asc(experiments.key));
}

export async function getExperiment(key: string): Promise<ExperimentRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(experiments).where(eq(experiments.key, key)).limit(1);
  return row ?? null;
}

export async function setExperimentStatus(key: string, status: ExperimentStatus): Promise<ExperimentRow | null> {
  const db = await getDb();
  const current = await getExperiment(key);
  if (!current) return null;
  const patch: Partial<typeof experiments.$inferInsert> = { status };
  if (status === "running" && !current.startedAt) patch.startedAt = new Date();
  if (status === "finished") patch.endedAt = new Date();
  const [row] = await db.update(experiments).set(patch).where(eq(experiments.key, key)).returning();
  return row ?? null;
}

export async function listFlags(): Promise<FlagRow[]> {
  const db = await getDb();
  return db.select().from(flags).orderBy(asc(flags.key));
}

export async function updateFlag(key: string, patch: Partial<Pick<FlagRow, "enabled" | "rollout" | "killSwitch">>): Promise<FlagRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(flags)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(flags.key, key))
    .returning();
  return row ?? null;
}

export interface NewEvent {
  experimentKey: string;
  variant: string;
  visitorId: string;
  kind: "exposure" | "conversion";
  goal?: string;
  props?: Record<string, string | number | boolean>;
}

/** Inserts events, ignoring duplicates (same experiment + visitor + kind + goal). Returns rows actually inserted. */
export async function recordEvents(rows: NewEvent[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = await getDb();
  const result = await db
    .insert(events)
    .values(rows.map((r) => ({ ...r, goal: r.goal ?? "" })))
    .onConflictDoNothing()
    .returning({ id: events.id });
  return result.length;
}

/**
 * Unique exposed visitors per variant and, among them, unique visitors who converted on `goal` at or
 * after their exposure. Conversions without a prior exposure in the same experiment are not counted,
 * and a conversion is credited to the variant the visitor was exposed to.
 */
export async function getVariantCounts(experiment: Pick<ExperimentDefinition, "key" | "variants" | "primaryGoal">): Promise<VariantCounts[]> {
  const db = await getDb();
  const conv = alias(events, "conv");
  const rows = await db
    .select({
      variant: events.variant,
      visitors: sql<number>`count(*)::int`,
      conversions: sql<number>`count(${conv.id})::int`,
    })
    .from(events)
    .leftJoin(
      conv,
      and(
        eq(conv.experimentKey, events.experimentKey),
        eq(conv.visitorId, events.visitorId),
        eq(conv.kind, "conversion"),
        eq(conv.goal, experiment.primaryGoal),
        // Only conversions that happened at or after the exposure count.
        gte(conv.createdAt, events.createdAt),
      ),
    )
    .where(and(eq(events.experimentKey, experiment.key), eq(events.kind, "exposure")))
    .groupBy(events.variant);

  const byVariant = new Map(rows.map((r) => [r.variant, r]));
  return experiment.variants.map((v) => ({
    key: v.key,
    name: v.name,
    visitors: Number(byVariant.get(v.key)?.visitors ?? 0),
    conversions: Number(byVariant.get(v.key)?.conversions ?? 0),
  }));
}

export async function countSyntheticEvents(experimentKey: string): Promise<{ total: number; synthetic: number }> {
  const db = await getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      synthetic: sql<number>`count(*) filter (where ${events.synthetic})::int`,
    })
    .from(events)
    .where(and(eq(events.experimentKey, experimentKey), eq(events.kind, "exposure")));
  return { total: Number(row?.total ?? 0), synthetic: Number(row?.synthetic ?? 0) };
}

/** Simulated ("Simulate traffic") exposures for an experiment; used to cap sandbox memory use. */
export async function countSimulatedExposures(experimentKey: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.experimentKey, experimentKey), eq(events.kind, "exposure"), like(events.visitorId, "sim-%")));
  return Number(row?.count ?? 0);
}
