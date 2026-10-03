import { hashToUnit } from "./hash";
import type { ExperimentDefinition, FlagDefinition, Variant } from "./types";

/** Bucket value in [0,1) for a visitor in an experiment. Drives the variant pick. */
export function bucket(visitorId: string, experimentKey: string): number {
  return hashToUnit(`${visitorId}:${experimentKey}`);
}

/**
 * Traffic allocation gate. Uses a separate salt from the variant bucket so that raising
 * the allocation from 20% to 50% only adds visitors; nobody already enrolled changes variant.
 */
export function isInTraffic(visitorId: string, experimentKey: string, allocationPct: number): boolean {
  if (allocationPct <= 0) return false;
  if (allocationPct >= 100) return true;
  return hashToUnit(`${visitorId}:${experimentKey}:traffic`) < allocationPct / 100;
}

/** Weighted pick: walks the cumulative weight distribution with u in [0,1). */
export function pickVariant(variants: readonly Variant[], u: number): Variant | null {
  const total = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (total <= 0 || variants.length === 0) return null;
  const target = u * total;
  let acc = 0;
  for (const v of variants) {
    acc += Math.max(0, v.weight);
    if (target < acc) return v;
  }
  // u < 1, so this is only reachable through float rounding: use the last weighted variant.
  return [...variants].reverse().find((v) => v.weight > 0) ?? null;
}

/** Allocation gate, then weighted pick. Returns the variant key, or null when not enrolled. */
export function assignVariant(
  visitorId: string,
  experiment: Pick<ExperimentDefinition, "key" | "trafficAllocation" | "variants">,
): string | null {
  if (!isInTraffic(visitorId, experiment.key, experiment.trafficAllocation)) return null;
  return pickVariant(experiment.variants, bucket(visitorId, experiment.key))?.key ?? null;
}

/** Flag rollout: on when enabled, not killed, and the visitor falls inside the rollout percentage. */
export function evaluateFlag(visitorId: string, flag: FlagDefinition): boolean {
  if (flag.killSwitch || !flag.enabled) return false;
  if (flag.rollout >= 100) return true;
  if (flag.rollout <= 0) return false;
  return hashToUnit(`${visitorId}:flag:${flag.key}`) < flag.rollout / 100;
}
