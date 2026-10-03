import type { ExperimentStatus } from "@/lib/core/types";

const styles: Record<ExperimentStatus, string> = {
  running: "border-good/40 bg-good/10 text-good",
  paused: "border-warn/40 bg-warn/10 text-warn",
  finished: "border-border bg-surface-2 text-muted",
  draft: "border-border text-faint",
};

export function StatusBadge({ status }: { status: ExperimentStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${styles[status]}`}>{status}</span>;
}
