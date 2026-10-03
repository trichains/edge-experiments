"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { adminFetch, useAdminToken } from "@/components/admin";
import type { FlagDefinition } from "@/lib/core/types";

export function FlagRow({ flag }: { flag: FlagDefinition }) {
  const id = useId();
  const router = useRouter();
  const token = useAdminToken();
  const [rollout, setRollout] = useState(flag.rollout);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function patch(body: Partial<Pick<FlagDefinition, "enabled" | "rollout" | "killSwitch">>) {
    setError(null);
    const res = await adminFetch(`/api/flags/${flag.key}`, { method: "PATCH", token, body: JSON.stringify(body) });
    if (!res.ok) {
      setError(res.status === 401 ? "Admin token required." : `Failed (${res.status}).`);
      return;
    }
    startTransition(() => router.refresh());
  }

  const effective = flag.killSwitch ? "Off (kill switch)" : !flag.enabled ? "Off" : `On for ${flag.rollout}%`;

  return (
    <li className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center" data-testid={`flag-${flag.key}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium">{flag.key}</span>
          <span className={`rounded-full border px-2 py-0.5 text-xs ${flag.killSwitch ? "border-bad/40 text-bad" : flag.enabled ? "border-good/40 text-good" : "border-border text-faint"}`}>
            {effective}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{flag.description}</p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-bad">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            role="switch"
            checked={flag.enabled}
            disabled={pending}
            onChange={(e) => void patch({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Enabled
        </label>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`${id}-rollout`} className="text-muted">
            Rollout
          </label>
          <input
            id={`${id}-rollout`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={rollout}
            onChange={(e) => setRollout(Number(e.target.value))}
            onPointerUp={() => rollout !== flag.rollout && void patch({ rollout })}
            onKeyUp={() => rollout !== flag.rollout && void patch({ rollout })}
            className="w-28 accent-[var(--accent)]"
          />
          <span className="tabular w-10 text-right">{rollout}%</span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void patch({ killSwitch: !flag.killSwitch })}
          className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${flag.killSwitch ? "border-border hover:bg-surface-2" : "border-bad/50 text-bad hover:bg-bad/10"}`}
        >
          {flag.killSwitch ? "Release kill switch" : "Kill switch"}
        </button>
      </div>
    </li>
  );
}
