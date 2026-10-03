"use client";

import { useFlag } from "@/lib/sdk/client";

/** Client-side flag read: the value was decided by the proxy and hydrated through the provider. */
export function PromoBanner() {
  const on = useFlag("promo-banner");
  if (!on) return null;
  return (
    <div className="bg-[#1b1d21] px-5 py-2 text-center text-sm text-white" data-testid="promo-banner">
      Annual plans include two months free.
    </div>
  );
}
