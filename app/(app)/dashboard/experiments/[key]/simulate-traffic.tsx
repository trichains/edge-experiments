"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { adminFetch, useAdminToken } from "@/components/admin";
import { int } from "@/lib/format";

const DEFAULT_RATES = [4, 5, 5, 5, 5, 5];

export function SimulateTraffic({ experimentKey, variants }: { experimentKey: string; variants: { key: string; name: string }[] }) {
  const id = useId();
  const router = useRouter();
  const token = useAdminToken();
  const [visitors, setVisitors] = useState("2000");
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(variants.map((v, i) => [v.key, String(DEFAULT_RATES[i] ?? 5)])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function run() {
    setMessage(null);
    const res = await adminFetch("/api/simulate", {
      method: "POST",
      token,
      body: JSON.stringify({
        experimentKey,
        visitors: Number(visitors),
        rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Number(v) / 100])),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(`Failed: ${data.error ?? res.status}`);
      return;
    }
    setMessage(`Added ${int(data.visitors)} synthetic visitors and ${int(data.conversions)} conversions.`);
    startTransition(() => router.refresh());
  }

  const field = "w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm tabular";
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <h2 id={`${id}-title`} className="font-semibold">
          Simulate traffic
        </h2>
        <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[11px] text-warn">sandbox only</span>
      </div>
      <p className="mt-1 text-xs text-faint">
        Generates synthetic visitors, bucketed with the same hash as real traffic. Each one converts with the true rate you set for its
        variant, so you can watch how long it takes for a real difference to become significant.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label className="block space-y-1 text-xs text-muted">
          <span>Visitors (10 to 20,000)</span>
          <input className={field} type="number" min={10} max={20000} value={visitors} onChange={(e) => setVisitors(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {variants.map((v) => (
            <label key={v.key} className="space-y-1 text-xs text-muted">
              <span>
                True rate for <span className="font-mono">{v.key}</span> (%)
              </span>
              <input
                className={field}
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={rates[v.key]}
                onChange={(e) => setRates((r) => ({ ...r, [v.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
            {pending ? "Refreshing…" : "Simulate traffic"}
          </button>
          <p role="status" className="text-xs text-muted">
            {message}
          </p>
        </div>
      </form>
    </section>
  );
}
