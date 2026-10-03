import Link from "next/link";
import { REPO_URL } from "@/lib/site";

const steps = [
  {
    title: "Assigned before render",
    body: "proxy.ts reads the visitor cookie, buckets them with a deterministic hash and rewrites /demo/landing to the variant route. The browser receives the right HTML on the first byte, so there's nothing to swap and no flicker.",
  },
  {
    title: "No database at the edge",
    body: "The proxy only fetches /api/config, a small JSON document with a 30s CDN cache. Assignments live in a compact cookie, so a returning visitor costs zero lookups.",
  },
  {
    title: "Results you can defend",
    body: "Exposures and conversions are deduplicated per visitor. The results page shows Wilson 95% intervals, relative uplift, a two-proportion z-test and a sample size calculator.",
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Edge Experiments</h1>
        <p className="text-lg text-muted">
          A/B tests and feature flags for landing and sales pages, evaluated in Next.js <code className="font-mono text-text">proxy.ts</code>{" "}
          before the page renders. Visitors keep their variant through a cookie, the page reads it on the server, and a beacon reports
          exposures and conversions to a results page with proper statistics.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/demo/landing" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90">
            Open the demo landing page
          </Link>
          <Link href="/dashboard/experiments/landing-hero" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            See the results page
          </Link>
          <a href={REPO_URL} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2" rel="noreferrer">
            Source on GitHub
          </a>
        </div>
      </section>

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="text-sm font-medium uppercase tracking-wide text-faint">
          How it works
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.title} className="rounded-lg border border-border bg-surface p-5">
              <h3 className="font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="try" className="max-w-3xl space-y-3 text-sm text-muted">
        <h2 id="try" className="text-sm font-medium uppercase tracking-wide text-faint">
          Try it
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Open the demo page. A chip at the bottom shows which variant you got.</li>
          <li>Reload: you stay in the same variant. Use &quot;switch variant&quot; to get a new visitor id.</li>
          <li>Click the call to action, then check the experiment results. Your click is one conversion.</li>
          <li>Use &quot;Simulate traffic&quot; on the results page to add synthetic visitors with conversion rates you choose.</li>
        </ol>
      </section>
    </div>
  );
}
