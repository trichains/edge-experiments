"use client";

import { useState } from "react";
import { track } from "@/lib/sdk/client";

export function CtaButton({ label, accent, note }: { label: string; accent: boolean; note: string }) {
  const [clicked, setClicked] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          data-testid="cta"
          onClick={() => {
            track("signup_click", { placement: "hero" });
            setClicked(true);
          }}
          className={
            accent
              ? "rounded-md bg-[#c4511a] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#b84a15]"
              : "rounded-md bg-[#1b1d21] px-6 py-3 text-base font-semibold text-white hover:bg-[#33363c]"
          }
        >
          {label}
        </button>
        <span className="text-sm text-[#6b6f76]">{note}</span>
      </div>
      {/* Below the row with reserved height, so the message doesn't shift the button or the note. */}
      <p role="status" className="mt-3 min-h-5 text-sm text-[#4a4e55]">
        {clicked ? "Recorded as a signup_click conversion. This is a demo, so no account was created." : ""}
      </p>
    </div>
  );
}
