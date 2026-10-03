import Link from "next/link";
import { SandboxBadge } from "@/components/sandbox-badge";
import { isSandbox } from "@/lib/env";

import { REPO_URL } from "@/lib/site";

const nav = [
  { href: "/dashboard/experiments", label: "Experiments" },
  { href: "/dashboard/flags", label: "Flags" },
  { href: "/demo/landing", label: "Demo page" },
];

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">
            Edge Experiments
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm text-muted">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-text">
                {item.label}
              </Link>
            ))}
            <a href={REPO_URL} className="hover:text-text" rel="noreferrer">
              GitHub
            </a>
          </nav>
          {isSandbox() && <SandboxBadge className="sm:ml-auto" />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-faint sm:px-6">
          Built by Cristhian Almeida · MIT licensed ·{" "}
          <a href={REPO_URL} className="underline hover:text-muted">
            source
          </a>
        </div>
      </footer>
    </div>
  );
}
