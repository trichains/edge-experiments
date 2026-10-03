"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch, useAdminToken } from "@/components/admin";
import type { ExperimentStatus } from "@/lib/core/types";

const ACTIONS: Record<ExperimentStatus, { to: ExperimentStatus; label: string }[]> = {
  draft: [{ to: "running", label: "Start" }],
  running: [
    { to: "paused", label: "Pause" },
    { to: "finished", label: "Finish" },
  ],
  paused: [
    { to: "running", label: "Resume" },
    { to: "finished", label: "Finish" },
  ],
  finished: [],
};

export function StatusControls({ experimentKey, status }: { experimentKey: string; status: ExperimentStatus }) {
  const router = useRouter();
  const token = useAdminToken();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const actions = ACTIONS[status];
  if (actions.length === 0) return null;

  async function change(to: ExperimentStatus) {
    setError(null);
    const res = await adminFetch(`/api/experiments/${experimentKey}`, { method: "PATCH", token, body: JSON.stringify({ status: to }) });
    if (!res.ok) {
      setError(res.status === 401 ? "Admin token required." : `Failed (${res.status}).`);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.to}
          type="button"
          disabled={pending}
          onClick={() => void change(a.to)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
      <span className="text-xs text-faint">Proxy picks up status changes within ~30s.</span>
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
    </div>
  );
}
