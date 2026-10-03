import { assignVariant, evaluateFlag } from "./bucketing";
import type { Assignments } from "./cookie-format";
import { matchesTargeting, type RequestContext } from "./targeting";
import type { EdgeConfig, ExperimentDefinition } from "./types";

export interface Evaluation {
  /** What goes back into the `ex_a` cookie (sticky). */
  cookieAssignments: Assignments;
  /** Assignments active for this request (running experiments only), forwarded as `x-experiments`. */
  active: Assignments;
  flags: Record<string, boolean>;
  /** Experiment whose rewrite applies to this path, if any. */
  rewrite: { experiment: ExperimentDefinition; variant: string } | null;
  /** True when the cookie needs to be written back. */
  changed: boolean;
}

/**
 * Pure evaluation used by proxy.ts. No I/O and no Node APIs, so it runs the same in the
 * Node.js proxy runtime, the Edge runtime and unit tests.
 *
 * Rules:
 * - An existing cookie assignment wins while the experiment is running and the variant still
 *   exists (stickiness; targeting is not re-checked).
 * - New visitors are only enrolled while the experiment is running.
 * - Visitors that fail targeting or the traffic gate are not stored, so they are re-evaluated on
 *   the next request (a later visit with a matching UTM can still enroll them).
 * - Cookie entries for experiments that no longer exist (or variants that were removed) are dropped.
 *   Entries for paused/finished experiments are kept but not forwarded, so pages fall back to control.
 */
export function evaluate(
  config: EdgeConfig,
  visitorId: string,
  existing: Assignments,
  ctx: RequestContext,
  pathname: string,
): Evaluation {
  const byKey = new Map(config.experiments.map((e) => [e.key, e]));
  const cookieAssignments: Assignments = {};
  const active: Assignments = {};
  let changed = false;

  for (const [key, variant] of Object.entries(existing)) {
    const exp = byKey.get(key);
    if (!exp || !exp.variants.some((v) => v.key === variant)) {
      changed = true;
      continue;
    }
    cookieAssignments[key] = variant;
  }

  for (const exp of config.experiments) {
    if (exp.status !== "running") continue;
    const current = cookieAssignments[exp.key];
    if (current) {
      active[exp.key] = current;
      continue;
    }
    if (!matchesTargeting(exp.targeting, ctx)) continue;
    const variant = assignVariant(visitorId, exp);
    if (!variant) continue;
    cookieAssignments[exp.key] = variant;
    active[exp.key] = variant;
    changed = true;
  }

  const flags: Record<string, boolean> = {};
  for (const flag of config.flags) flags[flag.key] = evaluateFlag(visitorId, flag);

  let rewrite: Evaluation["rewrite"] = null;
  const path = normalizePath(pathname);
  for (const exp of config.experiments) {
    if (exp.mode === "rewrite" && active[exp.key] && path === normalizePath(exp.path)) {
      rewrite = { experiment: exp, variant: active[exp.key] };
      break;
    }
  }

  return { cookieAssignments, active, flags, rewrite, changed };
}

/**
 * A rewrite target reached directly (e.g. /demo/landing/benefit). The proxy redirects these to the
 * base path so a visitor can't see one variant while being counted in another.
 */
export function directVariantHit(config: EdgeConfig, pathname: string): ExperimentDefinition | null {
  const path = normalizePath(pathname);
  for (const exp of config.experiments) {
    if (exp.mode !== "rewrite") continue;
    const base = normalizePath(exp.path);
    if (path.startsWith(`${base}/`) && exp.variants.some((v) => v.key === path.slice(base.length + 1))) {
      return exp;
    }
  }
  return null;
}

export function normalizePath(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}
