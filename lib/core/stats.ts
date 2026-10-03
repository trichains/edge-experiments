/**
 * Frequentist statistics for two-variant conversion tests. Pure functions, no dependencies.
 * Every function is covered against published reference values in tests/unit/stats.test.ts.
 */

/**
 * Standard normal CDF Φ(x). Hart (1968) algorithm 5666 as published by G. West,
 * "Better approximations to cumulative normal functions" (2005). Double precision accuracy.
 */
export function normalCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) {
    c = 0;
  } else {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/**
 * Inverse standard normal CDF. Peter Acklam's rational approximation (rel. error 1.15e-9)
 * followed by one Halley refinement step using normalCdf, which brings it to ~1e-15.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new RangeError("p must be in [0, 1]");
  }
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Halley step
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

export interface Interval {
  low: number;
  high: number;
}

/** Wilson score interval for a binomial proportion. Defaults to 95% (z = 1.95996...). */
export function wilsonInterval(conversions: number, visitors: number, confidence = 0.95): Interval {
  if (visitors <= 0) return { low: 0, high: 0 };
  const z = normalQuantile(1 - (1 - confidence) / 2);
  const p = conversions / visitors;
  const z2 = z * z;
  const denom = 1 + z2 / visitors;
  const center = (p + z2 / (2 * visitors)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / visitors + z2 / (4 * visitors * visitors))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export interface ZTestResult {
  z: number;
  /** Two-sided p-value. */
  pValue: number;
}

/**
 * Two-proportion z-test with pooled variance, two-sided. Equivalent to Pearson's chi-square on the
 * 2x2 table without continuity correction (R: `prop.test(x, n, correct = FALSE)`), since χ² = z².
 */
export function twoProportionZTest(convA: number, nA: number, convB: number, nB: number): ZTestResult {
  if (nA <= 0 || nB <= 0) return { z: 0, pValue: 1 };
  const pA = convA / nA;
  const pB = convB / nB;
  const pooled = (convA + convB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return { z: 0, pValue: 1 };
  const z = (pB - pA) / se;
  return { z, pValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) };
}

/** Relative uplift of B over A: (pB - pA) / pA. Null when the baseline rate is 0. */
export function relativeUplift(convA: number, nA: number, convB: number, nB: number): number | null {
  if (nA <= 0 || nB <= 0) return null;
  const pA = convA / nA;
  if (pA === 0) return null;
  return (convB / nB - pA) / pA;
}

export interface SampleSizeInput {
  /** Baseline conversion rate, e.g. 0.2 for 20%. */
  baseline: number;
  /** Minimum detectable effect, absolute (0.05 = +5 percentage points) or relative (0.1 = +10%). */
  mde: number;
  mdeType?: "absolute" | "relative";
  alpha?: number;
  power?: number;
}

/**
 * Visitors needed per variant for a two-sided test. Same formula as Evan Miller's sample size
 * calculator (https://www.evanmiller.org/ab-testing/sample-size.html):
 *   n = (z_{1-α/2}·√(2p(1-p)) + z_{power}·√(p(1-p) + (p+δ)(1-p-δ)))² / δ²
 * Returns null when the inputs are out of range (e.g. baseline + effect above 100%).
 */
export function sampleSizePerVariant(input: SampleSizeInput): number | null {
  const { baseline: p, mde, mdeType = "absolute", alpha = 0.05, power = 0.8 } = input;
  const delta = mdeType === "relative" ? p * mde : mde;
  if (!(p > 0 && p < 1) || !(delta > 0) || p + delta >= 1 || !(alpha > 0 && alpha < 1) || !(power > 0 && power < 1)) {
    return null;
  }
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const sd1 = Math.sqrt(2 * p * (1 - p));
  const sd2 = Math.sqrt(p * (1 - p) + (p + delta) * (1 - p - delta));
  const n = (zAlpha * sd1 + zBeta * sd2) ** 2 / (delta * delta);
  return Math.ceil(n);
}

export interface VariantCounts {
  key: string;
  name: string;
  visitors: number;
  conversions: number;
}

export interface VariantResult extends VariantCounts {
  rate: number;
  ci: Interval;
  isControl: boolean;
  /** Relative uplift vs control (null for the control row or when control rate is 0). */
  uplift: number | null;
  pValue: number | null;
  z: number | null;
  significant: boolean;
}

export type Verdict = "not_enough_data" | "not_significant" | "significant_better" | "significant_worse";

/** Minimum visitors per variant before a verdict is shown at all. */
export const MIN_VISITORS_FOR_VERDICT = 100;

/** Builds the per-variant result table. The first entry is the control. */
export function analyze(variants: VariantCounts[], alpha = 0.05): { rows: VariantResult[]; verdict: Verdict; best: VariantResult | null } {
  const [control] = variants;
  const rows: VariantResult[] = variants.map((v, i) => {
    const rate = v.visitors > 0 ? v.conversions / v.visitors : 0;
    const base = { ...v, rate, ci: wilsonInterval(v.conversions, v.visitors, 1 - alpha), isControl: i === 0 };
    if (i === 0 || !control) return { ...base, uplift: null, pValue: null, z: null, significant: false };
    const test = twoProportionZTest(control.conversions, control.visitors, v.conversions, v.visitors);
    return {
      ...base,
      uplift: relativeUplift(control.conversions, control.visitors, v.conversions, v.visitors),
      pValue: test.pValue,
      z: test.z,
      significant: test.pValue < alpha,
    };
  });

  const challengers = rows.slice(1);
  if (rows.length < 2 || rows.some((r) => r.visitors < MIN_VISITORS_FOR_VERDICT)) {
    return { rows, verdict: "not_enough_data", best: null };
  }
  const significant = challengers.filter((r) => r.significant);
  if (significant.length === 0) return { rows, verdict: "not_significant", best: null };
  const best = significant.reduce((a, b) => ((b.z ?? 0) > (a.z ?? 0) ? b : a));
  return { rows, verdict: (best.z ?? 0) > 0 ? "significant_better" : "significant_worse", best };
}
