/**
 * Compact assignment encoding used by the `ex_a` cookie and the `x-experiments` header:
 *   "landing-hero:benefit;social-proof:logos"
 * Keys and variant keys are restricted to [a-z0-9-], so ":" and ";" never need escaping.
 *
 * Not signed: a visitor can edit their own cookie and pick a variant, which only changes
 * their own experience. The track endpoint re-validates every pair against the config.
 */
export type Assignments = Record<string, string>;

const PAIR = /^([a-z0-9][a-z0-9-]{0,62}):([a-z0-9][a-z0-9-]{0,62})$/;
const KEY = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** Keeps the cookie well under the 4 KB browser limit. */
export const MAX_ASSIGNMENTS = 40;

export function encodeAssignments(assignments: Assignments): string {
  return Object.entries(assignments)
    .filter(([k, v]) => PAIR.test(`${k}:${v}`))
    .slice(0, MAX_ASSIGNMENTS)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

export function decodeAssignments(raw: string | null | undefined): Assignments {
  const out: Assignments = {};
  if (!raw) return out;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // malformed escape sequence: parse the raw value
  }
  for (const part of value.split(";")) {
    const match = PAIR.exec(part.trim());
    if (match && Object.keys(out).length < MAX_ASSIGNMENTS) out[match[1]] = match[2];
  }
  return out;
}

/** Flags use the same shape with "1"/"0" values: "promo-banner:1;new-pricing:0". */
export function encodeFlags(flags: Record<string, boolean>): string {
  return Object.entries(flags)
    .filter(([k]) => KEY.test(k))
    .map(([k, v]) => `${k}:${v ? "1" : "0"}`)
    .join(";");
}

export function decodeFlags(raw: string | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw) return out;
  for (const part of raw.split(";")) {
    const [k, v] = part.trim().split(":");
    if (k && KEY.test(k) && (v === "1" || v === "0")) out[k] = v === "1";
  }
  return out;
}
