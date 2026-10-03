import { describe, expect, it } from "vitest";
import {
  analyze,
  normalCdf,
  normalQuantile,
  relativeUplift,
  sampleSizePerVariant,
  twoProportionZTest,
  wilsonInterval,
} from "@/lib/core/stats";

describe("normal distribution", () => {
  // Reference: standard normal tables / R qnorm(), pnorm().
  it("matches known quantiles", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963985, 8); // qnorm(0.975)
    expect(normalQuantile(0.8)).toBeCloseTo(0.8416212336, 8); // qnorm(0.8)
    expect(normalQuantile(0.5)).toBeCloseTo(0, 12);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232306, 7); // qnorm(0.001)
  });

  it("matches known CDF values and inverts the quantile", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1.959963985)).toBeCloseTo(0.975, 9);
    expect(normalCdf(-1)).toBeCloseTo(0.1586552539, 9); // pnorm(-1)
    for (const p of [0.01, 0.2, 0.5, 0.9, 0.999]) expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 10);
  });
});

describe("wilsonInterval", () => {
  // Reference: Wilson (1927) score interval, 95%. 0/10 → [0, 0.2775] and 5/10 → [0.2366, 0.7634] are the
  // textbook values (also returned by statsmodels proportion_confint(method="wilson")).
  it("0 of 10", () => {
    const ci = wilsonInterval(0, 10);
    expect(ci.low).toBeCloseTo(0, 6);
    expect(ci.high).toBeCloseTo(0.2775, 4);
  });

  it("5 of 10", () => {
    const ci = wilsonInterval(5, 10);
    expect(ci.low).toBeCloseTo(0.2366, 4);
    expect(ci.high).toBeCloseTo(0.7634, 4);
  });

  it("stays inside [0,1] and narrows with more data", () => {
    const small = wilsonInterval(10, 100);
    const large = wilsonInterval(1000, 10000);
    expect(small.low).toBeGreaterThanOrEqual(0);
    expect(wilsonInterval(10, 10).high).toBeLessThanOrEqual(1);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 });
  });
});

describe("twoProportionZTest", () => {
  // Reference: R `prop.test(c(200, 250), c(1000, 1000), correct = FALSE)` →
  // X-squared = 7.1685, p-value = 0.007419. For a 2x2 table χ² = z², so z = 2.6774.
  it("matches R prop.test without continuity correction", () => {
    const { z, pValue } = twoProportionZTest(200, 1000, 250, 1000);
    expect(z).toBeCloseTo(2.6774, 4);
    expect(z * z).toBeCloseTo(7.1685, 3);
    expect(pValue).toBeCloseTo(0.007419, 5);
  });

  it("is symmetric and returns p = 1 for identical or empty groups", () => {
    expect(twoProportionZTest(250, 1000, 200, 1000).z).toBeCloseTo(-2.6774, 4);
    expect(twoProportionZTest(50, 1000, 50, 1000).pValue).toBe(1);
    expect(twoProportionZTest(0, 0, 1, 10).pValue).toBe(1);
    expect(twoProportionZTest(0, 100, 0, 100).pValue).toBe(1);
  });

  it("p ≈ 0.05 exactly at |z| = 1.96", () => {
    // Construct counts and check the boundary through the CDF directly.
    expect(2 * (1 - normalCdf(1.959963985))).toBeCloseTo(0.05, 9);
  });
});

describe("relativeUplift", () => {
  it("computes (pB - pA) / pA", () => {
    expect(relativeUplift(200, 1000, 250, 1000)).toBeCloseTo(0.25, 12);
    expect(relativeUplift(100, 1000, 90, 1000)).toBeCloseTo(-0.1, 12);
    expect(relativeUplift(0, 1000, 10, 1000)).toBeNull();
  });
});

describe("sampleSizePerVariant", () => {
  // Reference: Evan Miller's sample size calculator (https://www.evanmiller.org/ab-testing/sample-size.html),
  // two-sided, α = 0.05, power = 0.8. Its default example (baseline 20%, MDE 5pp absolute) shows 1,030 per
  // variation; the unrounded value of the same formula is 1030.2, and we round up, hence ±1.
  it("matches Evan Miller's default example", () => {
    const n = sampleSizePerVariant({ baseline: 0.2, mde: 0.05 })!;
    expect(Math.abs(n - 1030)).toBeLessThanOrEqual(1);
  });

  it("matches the same formula for other inputs", () => {
    // Baseline 10%, MDE 2pp absolute → 3,623 per variation in Evan Miller's calculator.
    expect(sampleSizePerVariant({ baseline: 0.1, mde: 0.02 })).toBe(3623);
    // Relative MDE converts to absolute: 5% baseline, +20% relative = +1pp.
    expect(sampleSizePerVariant({ baseline: 0.05, mde: 0.2, mdeType: "relative" })).toBe(sampleSizePerVariant({ baseline: 0.05, mde: 0.01 }));
  });

  it("needs more visitors for smaller effects or more power", () => {
    const base = sampleSizePerVariant({ baseline: 0.05, mde: 0.01 })!;
    expect(sampleSizePerVariant({ baseline: 0.05, mde: 0.005 })!).toBeGreaterThan(base * 3);
    expect(sampleSizePerVariant({ baseline: 0.05, mde: 0.01, power: 0.9 })!).toBeGreaterThan(base);
  });

  it("rejects impossible inputs", () => {
    expect(sampleSizePerVariant({ baseline: 0, mde: 0.01 })).toBeNull();
    expect(sampleSizePerVariant({ baseline: 0.95, mde: 0.1 })).toBeNull();
    expect(sampleSizePerVariant({ baseline: 0.1, mde: 0 })).toBeNull();
  });
});

describe("analyze", () => {
  const variants = (a: [number, number], b: [number, number]) => [
    { key: "control", name: "Control", visitors: a[0], conversions: a[1] },
    { key: "b", name: "B", visitors: b[0], conversions: b[1] },
  ];

  it("labels a clear winner as significant", () => {
    const { verdict, rows } = analyze(variants([1000, 200], [1000, 250]));
    expect(verdict).toBe("significant_better");
    expect(rows[1].uplift).toBeCloseTo(0.25, 10);
    expect(rows[1].significant).toBe(true);
    expect(rows[0].isControl).toBe(true);
  });

  it("labels a small difference as not significant", () => {
    expect(analyze(variants([1000, 50], [1000, 55])).verdict).toBe("not_significant");
  });

  it("labels a significant loss", () => {
    expect(analyze(variants([1000, 250], [1000, 200])).verdict).toBe("significant_worse");
  });

  it("refuses a verdict with too little data", () => {
    expect(analyze(variants([40, 2], [40, 20])).verdict).toBe("not_enough_data");
  });
});
