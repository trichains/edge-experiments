export function SandboxBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5 text-xs text-warn ${className}`}
      title="No DATABASE_URL configured: data lives in an in-memory PGlite database"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
      Sandbox: in-memory data, resets on cold start
    </span>
  );
}
