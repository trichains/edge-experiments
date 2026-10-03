import { cookies, headers } from "next/headers";
import {
  ASSIGNMENTS_COOKIE,
  EXPERIMENTS_HEADER,
  FLAGS_HEADER,
  VISITOR_COOKIE,
  VISITOR_HEADER,
} from "../core/constants";
import { decodeAssignments, decodeFlags } from "../core/cookie-format";
import type { ExperimentKey, ExperimentsSnapshot, FlagKey, VariantOf } from "./types";

/**
 * Reads what proxy.ts decided for this request. The `x-experiments` header is authoritative (it only
 * contains running experiments and covers a visitor's very first request, before the cookie exists).
 * If the proxy didn't run for this route, it falls back to the `ex_a` cookie.
 */
export async function getAssignments(): Promise<ExperimentsSnapshot> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const header = h.get(EXPERIMENTS_HEADER);
  return {
    visitorId: h.get(VISITOR_HEADER) ?? c.get(VISITOR_COOKIE)?.value ?? null,
    assignments: header !== null ? decodeAssignments(header) : decodeAssignments(c.get(ASSIGNMENTS_COOKIE)?.value),
    flags: decodeFlags(h.get(FLAGS_HEADER)),
  };
}

/** Variant for an experiment, or null when the visitor is not enrolled (render the control). */
export async function getVariant<K extends ExperimentKey>(key: K): Promise<VariantOf<K> | null> {
  const { assignments } = await getAssignments();
  return (assignments[key] as VariantOf<K> | undefined) ?? null;
}

export async function getFlag(key: FlagKey): Promise<boolean> {
  const { flags } = await getAssignments();
  return flags[key] ?? false;
}
