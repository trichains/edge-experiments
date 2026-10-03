import type { Metadata } from "next";
import { AdminTokenField } from "@/components/admin";
import { isAdminProtected } from "@/lib/server/admin";
import { listFlags, toFlag } from "@/lib/server/repo";
import { FlagRow } from "./flag-row";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  const flags = (await listFlags()).map(toFlag);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feature flags</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Flags are evaluated in the proxy with the same visitor hash as experiments, so a visitor inside a 30% rollout stays inside it.
          The kill switch forces a flag off for everyone without touching the rollout. Changes reach visitors within about 30 seconds.
        </p>
      </div>
      {isAdminProtected() && <AdminTokenField />}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {flags.map((f) => (
          <FlagRow key={f.key} flag={f} />
        ))}
      </ul>
    </div>
  );
}
