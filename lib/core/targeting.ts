import type { Targeting } from "./types";

export type Device = "mobile" | "desktop";

export interface RequestContext {
  utmSource: string | null;
  utmMedium: string | null;
  /** From `x-vercel-ip-country`; null when the header is absent (local dev, other hosts). */
  country: string | null;
  device: Device;
}

const MOBILE_UA = /Mobi|Android|iPhone|iPod|iPad|Windows Phone|webOS|BlackBerry/i;

export function detectDevice(userAgent: string | null | undefined): Device {
  return userAgent && MOBILE_UA.test(userAgent) ? "mobile" : "desktop";
}

export function buildRequestContext(input: { searchParams: URLSearchParams; headers: Headers }): RequestContext {
  const country = input.headers.get("x-vercel-ip-country");
  return {
    utmSource: input.searchParams.get("utm_source"),
    utmMedium: input.searchParams.get("utm_medium"),
    country: country ? country.toUpperCase() : null,
    device: detectDevice(input.headers.get("user-agent")),
  };
}

const eq = (a: string | null, b: string) => a !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Every configured rule must match (AND). An empty targeting object matches everyone.
 * A country rule never matches when the country is unknown: no guessing.
 */
export function matchesTargeting(targeting: Targeting, ctx: RequestContext): boolean {
  if (targeting.utmSource && !eq(ctx.utmSource, targeting.utmSource)) return false;
  if (targeting.utmMedium && !eq(ctx.utmMedium, targeting.utmMedium)) return false;
  if (targeting.countries && (!ctx.country || !targeting.countries.includes(ctx.country))) return false;
  if (targeting.device && targeting.device !== ctx.device) return false;
  return true;
}
