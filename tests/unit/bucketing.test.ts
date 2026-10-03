import { describe, expect, it } from "vitest";
import { assignVariant, bucket, evaluateFlag, isInTraffic, pickVariant } from "@/lib/core/bucketing";
import { fmix32, fnv1a32, hashToUnit } from "@/lib/core/hash";
import { mulberry32 } from "@/lib/db/seed";

/** Deterministic UUID-shaped ids so the distribution assertions are reproducible. */
function fakeUuids(n: number, seed = 42): string[] {
  const rand = mulberry32(seed);
  const hex = (len: number) => Array.from({ length: len }, () => Math.floor(rand() * 16).toString(16)).join("");
  return Array.from({ length: n }, () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`);
}

/** Pearson chi-square statistic against expected proportions. */
function chiSquare(observed: number[], expectedShares: number[]): number {
  const total = observed.reduce((a, b) => a + b, 0);
  return observed.reduce((sum, o, i) => {
    const e = total * expectedShares[i];
    return sum + (o - e) ** 2 / e;
  }, 0);
}

describe("fnv1a32", () => {
  // Reference vectors from the FNV spec (http://www.isthe.com/chongo/tech/comp/fnv/).
  it("matches the published test vectors", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
  });

  it("hashes UTF-8 bytes, not UTF-16 code units", () => {
    expect(fnv1a32("é")).not.toBe(fnv1a32("é".normalize("NFD")));
    expect(fnv1a32("ação")).toBe(fnv1a32("ação"));
  });

  it("fmix32 is a bijection-style mixer (no collisions on a sample)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) seen.add(fmix32(i));
    expect(seen.size).toBe(10_000);
  });
});

describe("hashToUnit / bucket", () => {
  it("is deterministic and in [0, 1)", () => {
    for (const id of fakeUuids(1000)) {
      const u = bucket(id, "landing-hero");
      expect(u).toBe(bucket(id, "landing-hero"));
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it("is independent across experiments", () => {
    const ids = fakeUuids(10_000, 7);
    let sameSide = 0;
    for (const id of ids) if (bucket(id, "exp-a") < 0.5 === bucket(id, "exp-b") < 0.5) sameSide++;
    // Independent experiments put ~50% of visitors on the "same side" of both splits.
    expect(sameSide / ids.length).toBeGreaterThan(0.48);
    expect(sameSide / ids.length).toBeLessThan(0.52);
  });

  it("is roughly uniform over 10 buckets (chi-square, df = 9)", () => {
    const counts = new Array(10).fill(0);
    for (const id of fakeUuids(10_000, 99)) counts[Math.floor(hashToUnit(`${id}:x`) * 10)]++;
    // Critical value for df=9 at p = 0.001 is 27.88.
    expect(chiSquare(counts, new Array(10).fill(0.1))).toBeLessThan(27.88);
  });
});

describe("pickVariant", () => {
  const variants = [
    { key: "a", name: "A", weight: 50 },
    { key: "b", name: "B", weight: 30 },
    { key: "c", name: "C", weight: 20 },
  ];

  it("walks the cumulative weights", () => {
    expect(pickVariant(variants, 0)?.key).toBe("a");
    expect(pickVariant(variants, 0.4999)?.key).toBe("a");
    expect(pickVariant(variants, 0.5)?.key).toBe("b");
    expect(pickVariant(variants, 0.7999)?.key).toBe("b");
    expect(pickVariant(variants, 0.8)?.key).toBe("c");
    expect(pickVariant(variants, 0.999999)?.key).toBe("c");
  });

  it("skips zero-weight variants and handles empty weights", () => {
    expect(pickVariant([{ key: "a", name: "A", weight: 0 }, { key: "b", name: "B", weight: 10 }], 0)?.key).toBe("b");
    expect(pickVariant([{ key: "a", name: "A", weight: 0 }], 0.3)).toBeNull();
    expect(pickVariant([], 0.3)).toBeNull();
  });
});

describe("assignVariant distribution", () => {
  const ids = fakeUuids(10_000, 2026);

  it("50/50 split: each variant within ±2% of expected, chi-square sane", () => {
    const exp = { key: "landing-hero", trafficAllocation: 100, variants: [{ key: "control", name: "c", weight: 50 }, { key: "outcome", name: "o", weight: 50 }] };
    const counts = { control: 0, outcome: 0 };
    for (const id of ids) counts[assignVariant(id, exp) as "control" | "outcome"]++;
    expect(counts.control / ids.length).toBeGreaterThan(0.48);
    expect(counts.control / ids.length).toBeLessThan(0.52);
    expect(counts.outcome / ids.length).toBeGreaterThan(0.48);
    expect(counts.outcome / ids.length).toBeLessThan(0.52);
    // df = 1, p = 0.001 critical value 10.83
    expect(chiSquare([counts.control, counts.outcome], [0.5, 0.5])).toBeLessThan(10.83);
  });

  it("respects uneven weights (70/30)", () => {
    const exp = { key: "w", trafficAllocation: 100, variants: [{ key: "a", name: "a", weight: 70 }, { key: "b", name: "b", weight: 30 }] };
    const a = ids.filter((id) => assignVariant(id, exp) === "a").length / ids.length;
    expect(Math.abs(a - 0.7)).toBeLessThan(0.02);
  });

  it("allocation gate enrolls ~allocation% and growing it keeps earlier visitors in place", () => {
    const variants = [{ key: "a", name: "a", weight: 50 }, { key: "b", name: "b", weight: 50 }];
    const at20 = ids.map((id) => assignVariant(id, { key: "gate", trafficAllocation: 20, variants }));
    const at50 = ids.map((id) => assignVariant(id, { key: "gate", trafficAllocation: 50, variants }));
    const enrolled20 = at20.filter(Boolean).length / ids.length;
    expect(Math.abs(enrolled20 - 0.2)).toBeLessThan(0.02);
    expect(Math.abs(at50.filter(Boolean).length / ids.length - 0.5)).toBeLessThan(0.02);
    at20.forEach((v, i) => {
      if (v) expect(at50[i]).toBe(v);
    });
  });

  it("allocation 0 and 100 are exact", () => {
    expect(isInTraffic(ids[0], "x", 0)).toBe(false);
    expect(ids.every((id) => isInTraffic(id, "x", 100))).toBe(true);
  });
});

describe("evaluateFlag", () => {
  const ids = fakeUuids(10_000, 5);
  const flag = { key: "new-pricing-table", description: "", enabled: true, rollout: 30, killSwitch: false };

  it("rolls out to ~rollout% of visitors, deterministically", () => {
    const on = ids.filter((id) => evaluateFlag(id, flag)).length / ids.length;
    expect(Math.abs(on - 0.3)).toBeLessThan(0.02);
    expect(evaluateFlag(ids[0], flag)).toBe(evaluateFlag(ids[0], flag));
  });

  it("kill switch and disabled always win", () => {
    expect(ids.some((id) => evaluateFlag(id, { ...flag, rollout: 100, killSwitch: true }))).toBe(false);
    expect(ids.some((id) => evaluateFlag(id, { ...flag, rollout: 100, enabled: false }))).toBe(false);
    expect(ids.every((id) => evaluateFlag(id, { ...flag, rollout: 100 }))).toBe(true);
  });
});
