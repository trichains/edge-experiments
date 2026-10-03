"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { ExperimentKey, ExperimentsSnapshot, FlagKey, VariantOf } from "./types";

const TRACK_URL = "/api/track";
const EMPTY: ExperimentsSnapshot = { visitorId: null, assignments: {}, flags: {} };
const ExperimentsContext = createContext<ExperimentsSnapshot>(EMPTY);

/** Fire-and-forget POST that survives page unloads. Uses text/plain so it's a CORS-simple request. */
function beacon(payload: unknown): boolean {
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    if (navigator.sendBeacon(TRACK_URL, new Blob([body], { type: "text/plain;charset=UTF-8" }))) return true;
  }
  if (typeof fetch === "function") {
    void fetch(TRACK_URL, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } }).catch(() => {});
    return true;
  }
  return false;
}

/** Records a conversion for every running experiment the visitor is in whose primary goal matches. */
export function track(goal: string, props?: Record<string, string | number | boolean>): boolean {
  return beacon({ type: "conversion", goal, props });
}

export interface ExperimentsProviderProps {
  /** Snapshot from `getAssignments()` on the server, so the first client render matches the HTML. */
  value: ExperimentsSnapshot;
  /**
   * Experiments actually rendered on this page. An exposure beacon is sent for them once the page
   * mounts in a real browser, which keeps prefetches and crawlers without JS out of the denominator.
   */
  exposures?: readonly ExperimentKey[];
  children: ReactNode;
}

export function ExperimentsProvider({ value, exposures = [], children }: ExperimentsProviderProps) {
  const sent = useRef<string | null>(null);
  const keys = exposures.filter((k) => value.assignments[k]).join(",");

  useEffect(() => {
    if (!keys || sent.current === keys) return;
    sent.current = keys;
    beacon({ type: "exposure", experiments: keys.split(",") });
  }, [keys]);

  return <ExperimentsContext.Provider value={value}>{children}</ExperimentsContext.Provider>;
}

export function useExperiments(): ExperimentsSnapshot {
  return useContext(ExperimentsContext);
}

export function useVariant<K extends ExperimentKey>(key: K): VariantOf<K> | null {
  return (useContext(ExperimentsContext).assignments[key] as VariantOf<K> | undefined) ?? null;
}

export function useFlag(key: FlagKey): boolean {
  return useContext(ExperimentsContext).flags[key] ?? false;
}
