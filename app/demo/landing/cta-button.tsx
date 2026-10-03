"use client";

import { useState } from "react";
import { track } from "@/lib/sdk/client";

export function CtaButton({ label, accent }: { label: string; accent: boolean }) {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="cta"
        onClick={() => {
          track("signup_click", { placement: "hero" });
          setClicked(true);
        }}
        className={
          accent
            ? "rounded-md bg-[#e9692c] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#d65d22]"
            : "rounded-md bg-[#1b1d21] px-6 py-3 text-base font-semibold text-white hover:bg-[#33363c]"
        }
      >
        {label}
      </button>
      <p role="status" className="min-h-5 text-sm text-[#4a4e55]">
        {clicked ? "Recorded as a signup_click conversion. This is a demo, so no account was created." : ""}
      </p>
    </div>
  );
}
