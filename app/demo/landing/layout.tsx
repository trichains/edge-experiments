import type { Metadata } from "next";
import { LANDING_EXPERIMENTS } from "@/lib/experiments";
import { ExperimentsProvider } from "@/lib/sdk/client";
import { getAssignments } from "@/lib/sdk/server";
import { DebugChip } from "./debug-chip";

export const metadata: Metadata = {
  title: "Demo landing page",
  robots: { index: false },
};

export default async function DemoLandingLayout({ children }: LayoutProps<"/demo/landing">) {
  const snapshot = await getAssignments();
  return (
    <ExperimentsProvider value={snapshot} exposures={LANDING_EXPERIMENTS}>
      <div className="min-h-full bg-[#fbfaf8] text-[#1b1d21]" style={{ colorScheme: "light" }}>
        {children}
      </div>
      <DebugChip sandbox={!process.env.DATABASE_URL} />
    </ExperimentsProvider>
  );
}
