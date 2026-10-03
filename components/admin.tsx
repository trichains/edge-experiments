"use client";

import { useSyncExternalStore } from "react";

const KEY = "ex_admin_token";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function write(value: string) {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // storage unavailable: token lives only for this render
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminToken(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}

/** fetch() with the admin token attached when one was entered. */
export function adminFetch(url: string, init: RequestInit & { token: string }): Promise<Response> {
  const { token, headers, ...rest } = init;
  return fetch(url, {
    ...rest,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
  });
}

/** Only rendered when ADMIN_TOKEN is configured on the server. Kept in sessionStorage for this tab. */
export function AdminTokenField() {
  const token = useAdminToken();
  return (
    <label className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      <span className="text-muted">Admin token</span>
      <input
        type="password"
        value={token}
        onChange={(e) => write(e.target.value)}
        className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 font-mono text-xs"
        placeholder="required to change experiments and flags"
        autoComplete="off"
      />
    </label>
  );
}
