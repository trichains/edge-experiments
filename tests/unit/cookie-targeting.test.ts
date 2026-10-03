import { describe, expect, it } from "vitest";
import { decodeAssignments, decodeFlags, encodeAssignments, encodeFlags, MAX_ASSIGNMENTS } from "@/lib/core/cookie-format";
import { buildRequestContext, detectDevice, matchesTargeting, type RequestContext } from "@/lib/core/targeting";

describe("assignment cookie format", () => {
  it("round-trips", () => {
    const a = { "landing-hero": "outcome", "social-proof": "logos" };
    const encoded = encodeAssignments(a);
    expect(encoded).toBe("landing-hero:outcome;social-proof:logos");
    expect(decodeAssignments(encoded)).toEqual(a);
  });

  it("accepts URL-encoded values (some clients encode ':' and ';')", () => {
    expect(decodeAssignments("landing-hero%3Aoutcome%3Bsocial-proof%3Ahidden")).toEqual({ "landing-hero": "outcome", "social-proof": "hidden" });
  });

  it("drops malformed and unsafe pairs instead of throwing", () => {
    expect(decodeAssignments("ok:yes;bad;:x;y:;UPPER:a;a:<script>;spaced : x")).toEqual({ ok: "yes" });
    expect(decodeAssignments("%E0%A4%A")).toEqual({});
    expect(decodeAssignments(undefined)).toEqual({});
    expect(encodeAssignments({ "Bad Key": "x", good: "v" })).toBe("good:v");
  });

  it("caps the number of entries", () => {
    const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`e${i}`, "a"]));
    expect(Object.keys(decodeAssignments(encodeAssignments(many)))).toHaveLength(MAX_ASSIGNMENTS);
  });

  it("encodes flags as 1/0", () => {
    expect(encodeFlags({ "promo-banner": true, "new-pricing-table": false })).toBe("promo-banner:1;new-pricing-table:0");
    expect(decodeFlags("promo-banner:1;new-pricing-table:0;junk:2;:1")).toEqual({ "promo-banner": true, "new-pricing-table": false });
  });
});

describe("targeting", () => {
  const ctx = (over: Partial<RequestContext> = {}): RequestContext => ({ utmSource: null, utmMedium: null, country: null, device: "desktop", ...over });

  it("detects mobile vs desktop from the user agent", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(detectDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("mobile");
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0")).toBe("desktop");
    expect(detectDevice(null)).toBe("desktop");
  });

  it("builds context from query string and headers", () => {
    const c = buildRequestContext({
      searchParams: new URLSearchParams("utm_source=facebook&utm_medium=paid"),
      headers: new Headers({ "x-vercel-ip-country": "br", "user-agent": "iPhone" }),
    });
    expect(c).toEqual({ utmSource: "facebook", utmMedium: "paid", country: "BR", device: "mobile" });
    expect(buildRequestContext({ searchParams: new URLSearchParams(), headers: new Headers() }).country).toBeNull();
  });

  it("empty targeting matches everyone", () => {
    expect(matchesTargeting({}, ctx())).toBe(true);
  });

  it("UTM equals is case-insensitive and requires presence", () => {
    expect(matchesTargeting({ utmSource: "facebook" }, ctx({ utmSource: "Facebook" }))).toBe(true);
    expect(matchesTargeting({ utmSource: "facebook" }, ctx({ utmSource: "google" }))).toBe(false);
    expect(matchesTargeting({ utmSource: "facebook" }, ctx())).toBe(false);
    expect(matchesTargeting({ utmMedium: "cpc" }, ctx({ utmMedium: "cpc" }))).toBe(true);
  });

  it("country never matches when unknown", () => {
    expect(matchesTargeting({ countries: ["BR", "PT"] }, ctx({ country: "PT" }))).toBe(true);
    expect(matchesTargeting({ countries: ["BR"] }, ctx({ country: "US" }))).toBe(false);
    expect(matchesTargeting({ countries: ["BR"] }, ctx())).toBe(false);
  });

  it("all rules must match", () => {
    const t = { utmSource: "google", utmMedium: "cpc", device: "desktop" as const };
    expect(matchesTargeting(t, ctx({ utmSource: "google", utmMedium: "cpc" }))).toBe(true);
    expect(matchesTargeting(t, ctx({ utmSource: "google", utmMedium: "cpc", device: "mobile" }))).toBe(false);
  });
});
