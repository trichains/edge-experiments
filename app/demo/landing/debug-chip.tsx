"use client";

import Link from "next/link";
import { useExperiments } from "@/lib/sdk/client";

/** Dev aid pinned to the bottom of the demo page. Not part of the "product" being tested. */
export function DebugChip({ sandbox }: { sandbox: boolean }) {
  const { assignments } = useExperiments();
  const hero = assignments["landing-hero"];
  const proof = assignments["social-proof"];
  return (
    <aside
      aria-label="Experiment debug info"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-fit flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#2a2e35] bg-[#111316]/95 px-3 py-2 text-xs text-[#d6d8dc] shadow-lg"
      data-testid="debug-chip"
    >
      {sandbox && <span className="rounded bg-[#d9a441]/15 px-1.5 py-0.5 text-[#e2b65c]">Sandbox</span>}
      <span>
        You are in variant <strong data-testid="variant-name" className="font-mono text-[#f2884b]">{hero ?? "control (not enrolled)"}</strong>
      </span>
      <span className="text-[#8d939c]">
        social-proof: <span className="font-mono">{proof ?? "not enrolled"}</span>
      </span>
      {/* Plain anchor: the reset is a route handler that sets cookies and redirects. */}
      <a href="/api/debug/reset?next=/demo/landing" className="underline decoration-[#f2884b] underline-offset-2 hover:text-white" data-testid="switch-variant">
        Switch variant
      </a>
      <Link href="/dashboard/experiments/landing-hero" className="underline underline-offset-2 hover:text-white">
        Results
      </Link>
    </aside>
  );
}
