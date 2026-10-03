import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTokenField } from "@/components/admin";
import { StatusBadge } from "@/components/status-badge";
import { analyze, MIN_VISITORS_FOR_VERDICT, sampleSizePerVariant, type Verdict } from "@/lib/core/stats";
import { isSandbox } from "@/lib/env";
import { date, int, pct, pValue, signedPct } from "@/lib/format";
import { isAdminProtected } from "@/lib/server/admin";
import { countSyntheticEvents, getExperiment, getVariantCounts, toDefinition } from "@/lib/server/repo";
import { CiChart } from "./ci-chart";
import { SampleSizeCalculator } from "./sample-size-calculator";
import { SimulateTraffic } from "./simulate-traffic";
import { StatusControls } from "./status-controls";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboard/experiments/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: `Results: ${key}` };
}

const VERDICT: Record<Verdict, { label: string; tone: string; body: string }> = {
  not_enough_data: {
    label: "Not enough data",
    tone: "border-border text-muted",
    body: `Each variant needs at least ${MIN_VISITORS_FOR_VERDICT} visitors before a verdict is shown.`,
  },
  not_significant: {
    label: "Not significant",
    tone: "border-border text-muted",
    body: "The difference could plausibly be noise at α = 0.05. Keep running until the planned sample size, or accept there's no detectable effect.",
  },
  significant_better: {
    label: "Significant: challenger converts better",
    tone: "border-good/40 text-good",
    body: "p < 0.05 on a two-sided z-test. Check that the planned sample size was reached before calling it; peeking inflates false positives.",
  },
  significant_worse: {
    label: "Significant: challenger converts worse",
    tone: "border-bad/40 text-bad",
    body: "p < 0.05 on a two-sided z-test, in the wrong direction. The control is the safer choice.",
  },
};

function describeTargeting(t: ReturnType<typeof toDefinition>["targeting"]): string {
  const parts = [
    t.utmSource && `utm_source = ${t.utmSource}`,
    t.utmMedium && `utm_medium = ${t.utmMedium}`,
    t.countries && `country in ${t.countries.join(", ")}`,
    t.device && `device = ${t.device}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" AND ") : "Everyone";
}

export default async function ExperimentResultsPage({ params }: PageProps<"/dashboard/experiments/[key]">) {
  const { key } = await params;
  const row = await getExperiment(key);
  if (!row) notFound();
  const experiment = toDefinition(row);
  const [counts, synthetic] = await Promise.all([getVariantCounts(experiment), countSyntheticEvents(key)]);
  const { rows, verdict } = analyze(counts);
  const control = rows[0];
  const plannedN = control && control.visitors > 0 && control.rate > 0 && control.rate < 0.5
    ? sampleSizePerVariant({ baseline: Math.round(control.rate * 1000) / 1000, mde: 0.2, mdeType: "relative" })
    : null;
  const v = VERDICT[verdict];
  const totalWeight = experiment.variants.reduce((s, x) => s + x.weight, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/dashboard/experiments" className="text-sm text-muted hover:text-text">
          ← All experiments
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{experiment.name}</h1>
          <StatusBadge status={experiment.status} />
        </div>
        <p className="max-w-3xl text-sm text-muted">{experiment.description}</p>
        {isAdminProtected() && <AdminTokenField />}
        <StatusControls experimentKey={experiment.key} status={experiment.status} />
      </div>

      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Key", <span key="k" className="font-mono">{experiment.key}</span>],
          ["Mode", <span key="m"><span className="font-mono">{experiment.mode}</span> on <span className="font-mono">{experiment.path}</span></span>],
          ["Primary goal", <span key="g" className="font-mono">{experiment.primaryGoal}</span>],
          ["Traffic allocation", `${experiment.trafficAllocation}% of eligible visitors`],
          ["Targeting", describeTargeting(experiment.targeting)],
          ["Split", experiment.variants.map((x) => `${x.key} ${Math.round((x.weight / totalWeight) * 100)}%`).join(" / ")],
          ["Started", date(row.startedAt)],
          ["Ended", date(row.endedAt)],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-surface px-4 py-3">
            <dt className="text-xs text-faint">{label}</dt>
            <dd className="mt-1">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="results" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results" className="text-lg font-semibold">
            Results
          </h2>
          {synthetic.synthetic > 0 && (
            <p className="text-xs text-faint" data-testid="synthetic-note">
              {int(synthetic.synthetic)} of {int(synthetic.total)} visitors are synthetic (seeded or simulated), not real traffic.
            </p>
          )}
        </div>

        <div className={`rounded-lg border bg-surface px-4 py-3 ${v.tone}`} data-testid="verdict">
          <p className="font-medium">{v.label}</p>
          <p className="mt-1 text-sm text-muted">{v.body}</p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm" data-testid="results-table">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2.5 font-medium">Variant</th>
                <th className="px-4 py-2.5 text-right font-medium">Visitors</th>
                <th className="px-4 py-2.5 text-right font-medium">Conversions</th>
                <th className="px-4 py-2.5 text-right font-medium">Rate</th>
                <th className="px-4 py-2.5 text-right font-medium">95% CI (Wilson)</th>
                <th className="px-4 py-2.5 text-right font-medium">Uplift vs control</th>
                <th className="px-4 py-2.5 text-right font-medium">p-value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 font-mono text-xs text-faint">
                      {r.key}
                      {r.isControl && r.key !== "control" ? " · control" : ""}
                    </span>
                  </td>
                  <td className="tabular px-4 py-3 text-right">{int(r.visitors)}</td>
                  <td className="tabular px-4 py-3 text-right">{int(r.conversions)}</td>
                  <td className="tabular px-4 py-3 text-right font-medium">{pct(r.rate)}</td>
                  <td className="tabular px-4 py-3 text-right text-muted">
                    {pct(r.ci.low)} – {pct(r.ci.high)}
                  </td>
                  <td className={`tabular px-4 py-3 text-right ${r.significant ? ((r.uplift ?? 0) > 0 ? "text-good" : "text-bad") : ""}`}>
                    {r.isControl ? "baseline" : signedPct(r.uplift)}
                  </td>
                  <td className="tabular px-4 py-3 text-right">{r.isControl ? "" : pValue(r.pValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <CiChart rows={rows} />

        <p className="text-xs text-faint">
          Visitors are unique exposed visitors. Conversions are unique visitors who were exposed and then fired{" "}
          <span className="font-mono">{experiment.primaryGoal}</span>. p-value: two-sided, pooled two-proportion z-test against the control.
          {plannedN !== null && (
            <> To detect a 20% relative change from the current control rate you need about {int(plannedN)} visitors per variant.</>
          )}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SampleSizeCalculator defaultBaseline={control && control.rate > 0 ? Math.round(control.rate * 1000) / 10 : 5} />
        {isSandbox() ? (
          <SimulateTraffic experimentKey={experiment.key} variants={experiment.variants.map((x) => ({ key: x.key, name: x.name }))} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted">Traffic simulation is only available in sandbox mode.</div>
        )}
      </div>
    </div>
  );
}
