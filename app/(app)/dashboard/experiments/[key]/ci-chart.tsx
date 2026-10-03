import type { VariantResult } from "@/lib/core/stats";
import { pct } from "@/lib/format";

/**
 * Conversion rate with its Wilson 95% interval per variant, on one shared axis starting at 0.
 * Overlapping bars are a quick visual hint; the p-value in the table is the actual test.
 */
export function CiChart({ rows }: { rows: VariantResult[] }) {
  const max = Math.max(0.01, ...rows.map((r) => r.ci.high)) * 1.1;
  const ticks = [0, max / 2, max];
  const x = (v: number) => `${(v / max) * 100}%`;

  return (
    <figure className="rounded-lg border border-border bg-surface p-4" aria-label="Conversion rate with 95% confidence interval per variant">
      <figcaption className="mb-3 text-xs text-faint">Conversion rate and 95% interval</figcaption>
      <div className="space-y-3">
        {rows.map((r) => {
          const tip = `${r.name}: ${pct(r.rate)} (95% CI ${pct(r.ci.low)} – ${pct(r.ci.high)}), ${r.conversions}/${r.visitors}`;
          const color = r.isControl ? "var(--neutral-mark)" : "var(--accent)";
          return (
            <div key={r.key} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
              <span className="truncate text-xs text-muted" title={r.name}>
                {r.key}
              </span>
              <div className="group relative h-6" title={tip} tabIndex={0} aria-label={tip}>
                <div className="absolute inset-y-[11px] left-0 right-0 rounded bg-surface-2" />
                {r.visitors > 0 && (
                  <>
                    <div
                      className="absolute inset-y-[8px] rounded"
                      style={{ left: x(r.ci.low), width: `max(2px, ${x(r.ci.high - r.ci.low)})`, background: color, opacity: 0.45 }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                      style={{ left: x(r.rate), background: color }}
                    />
                    <span
                      className="tabular pointer-events-none absolute -top-0.5 hidden -translate-x-1/2 -translate-y-full rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text group-hover:block group-focus:block"
                      style={{ left: x(r.rate) }}
                    >
                      {pct(r.rate)} · {pct(r.ci.low)} – {pct(r.ci.high)}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,7rem)_1fr] gap-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
        <span />
        <div className="relative h-4 text-[11px] text-faint">
          {ticks.map((t, i) => (
            <span key={i} className="tabular absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: x(t) }}>
              {pct(t, 1)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
