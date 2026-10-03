export const pct = (v: number, digits = 2) => `${(v * 100).toFixed(digits)}%`;

export const signedPct = (v: number | null, digits = 1) =>
  v === null ? "n/a" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;

export const int = (v: number) => new Intl.NumberFormat("en-US").format(v);

export const pValue = (p: number | null) => (p === null ? "n/a" : p < 0.0001 ? "< 0.0001" : p.toFixed(4));

export const date = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(d) : "n/a";
