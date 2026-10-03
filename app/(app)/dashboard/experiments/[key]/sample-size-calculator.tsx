"use client";

import { useId, useState } from "react";
import { sampleSizePerVariant } from "@/lib/core/stats";
import { int } from "@/lib/format";

export function SampleSizeCalculator({ defaultBaseline }: { defaultBaseline: number }) {
  const id = useId();
  const [baseline, setBaseline] = useState(String(defaultBaseline));
  const [mde, setMde] = useState("20");
  const [mdeType, setMdeType] = useState<"relative" | "absolute">("relative");

  const b = Number(baseline) / 100;
  const m = Number(mde) / 100;
  const n = sampleSizePerVariant({ baseline: b, mde: m, mdeType, alpha: 0.05, power: 0.8 });
  const target = mdeType === "relative" ? b * (1 + m) : b + m;

  const field = "w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm tabular";
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-border bg-surface p-5">
      <h2 id={`${id}-title`} className="font-semibold">
        Sample size calculator
      </h2>
      <p className="mt-1 text-xs text-faint">Two-sided test, α = 0.05, power = 0.8. Same formula as Evan Miller&apos;s calculator.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-muted">
          <span>Baseline rate (%)</span>
          <input className={field} inputMode="decimal" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted">
          <span>Minimum detectable effect (%)</span>
          <input className={field} inputMode="decimal" value={mde} onChange={(e) => setMde(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted">
          <span>Effect type</span>
          <select className={field} value={mdeType} onChange={(e) => setMdeType(e.target.value as "relative" | "absolute")}>
            <option value="relative">Relative</option>
            <option value="absolute">Absolute (pp)</option>
          </select>
        </label>
      </div>
      <div className="mt-4 rounded-md bg-surface-2 px-4 py-3" aria-live="polite">
        {n === null ? (
          <p className="text-sm text-muted">Enter a baseline between 0 and 100% and a positive effect that keeps the target under 100%.</p>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular" data-testid="sample-size">
              {int(n)} <span className="text-sm font-normal text-muted">visitors per variant</span>
            </p>
            <p className="mt-1 text-xs text-faint">
              Detects a change from {(b * 100).toFixed(2)}% to {(target * 100).toFixed(2)}%. {int(n * 2)} visitors in total for two variants.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
