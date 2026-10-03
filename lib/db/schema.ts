import { sql } from "drizzle-orm";
import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { ExperimentMode, ExperimentStatus, Targeting, Variant } from "../core/types";

export const experiments = pgTable("experiments", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").$type<ExperimentStatus>().notNull().default("draft"),
  trafficAllocation: integer("traffic_allocation").notNull().default(100),
  variants: jsonb("variants").$type<Variant[]>().notNull(),
  targeting: jsonb("targeting").$type<Targeting>().notNull().default({}),
  mode: text("mode").$type<ExperimentMode>().notNull().default("header"),
  path: text("path").notNull(),
  primaryGoal: text("primary_goal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const flags = pgTable("flags", {
  key: text("key").primaryKey(),
  description: text("description").notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  rollout: integer("rollout").notNull().default(0),
  killSwitch: boolean("kill_switch").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per (experiment, visitor, kind, goal). The unique index is what makes tracking
 * idempotent: repeated exposures or repeated clicks from the same visitor are ignored, so the
 * stats count unique visitors.
 */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    experimentKey: text("experiment_key")
      .notNull()
      .references(() => experiments.key, { onDelete: "cascade" }),
    variant: text("variant").notNull(),
    visitorId: text("visitor_id").notNull(),
    kind: text("kind").$type<"exposure" | "conversion">().notNull(),
    /** Empty string for exposures. */
    goal: text("goal").notNull().default(""),
    props: jsonb("props").$type<Record<string, string | number | boolean>>(),
    synthetic: boolean("synthetic").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("events_dedupe_idx").on(t.experimentKey, t.visitorId, t.kind, t.goal),
    index("events_experiment_kind_idx").on(t.experimentKey, t.kind, t.variant),
  ],
);

export type ExperimentRow = typeof experiments.$inferSelect;
export type FlagRow = typeof flags.$inferSelect;
