import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { int } from "@/lib/format";
import { getVariantCounts, listExperiments, toDefinition } from "@/lib/server/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Experiments" };

export default async function ExperimentsPage() {
  const rows = await listExperiments();
  const withCounts = await Promise.all(
    rows.map(async (row) => {
      const counts = await getVariantCounts(toDefinition(row));
      return { row, visitors: counts.reduce((s, c) => s + c.visitors, 0), conversions: counts.reduce((s, c) => s + c.conversions, 0) };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Experiments</h1>
        <p className="mt-1 text-sm text-muted">
          Running experiments are served to the proxy through <code className="font-mono">/api/config</code>. Changes reach visitors within about 30 seconds (CDN cache).
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-2.5 font-medium">Experiment</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Mode</th>
              <th className="px-4 py-2.5 text-right font-medium">Traffic</th>
              <th className="px-4 py-2.5 text-right font-medium">Visitors</th>
              <th className="px-4 py-2.5 text-right font-medium">Conversions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {withCounts.map(({ row, visitors, conversions }) => (
              <tr key={row.key} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/experiments/${row.key}`} className="font-medium hover:text-accent">
                    {row.name}
                  </Link>
                  <div className="font-mono text-xs text-faint">{row.key}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{row.mode}</td>
                <td className="tabular px-4 py-3 text-right">{row.trafficAllocation}%</td>
                <td className="tabular px-4 py-3 text-right">{int(visitors)}</td>
                <td className="tabular px-4 py-3 text-right">{int(conversions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
