import { describe, expect, it } from "vitest";
import { directVariantHit, evaluate } from "@/lib/core/evaluate";
import type { RequestContext } from "@/lib/core/targeting";
import { edgeConfigSchema, experimentDefinitionSchema, type EdgeConfig, type ExperimentDefinition } from "@/lib/core/types";

const hero: ExperimentDefinition = {
  key: "landing-hero",
  name: "Hero",
  description: "",
  status: "running",
  trafficAllocation: 100,
  variants: [
    { key: "control", name: "Control", weight: 50 },
    { key: "outcome", name: "Outcome", weight: 50 },
  ],
  targeting: {},
  mode: "rewrite",
  path: "/demo/landing",
  primaryGoal: "signup_click",
};

const config = (experiments: ExperimentDefinition[]): EdgeConfig => ({
  version: "1",
  generatedAt: new Date().toISOString(),
  experiments,
  flags: [{ key: "promo-banner", description: "", enabled: true, rollout: 100, killSwitch: false }],
});
const ctx: RequestContext = { utmSource: null, utmMedium: null, country: null, device: "desktop" };
const VID = "6b1f6c1e-3f7a-4c7e-9c1d-1f2e3d4c5b6a";

describe("evaluate", () => {
  it("assigns new visitors, marks the cookie as changed and rewrites the experiment path", () => {
    const r = evaluate(config([hero]), VID, {}, ctx, "/demo/landing");
    expect(["control", "outcome"]).toContain(r.active["landing-hero"]);
    expect(r.cookieAssignments).toEqual(r.active);
    expect(r.changed).toBe(true);
    expect(r.rewrite?.variant).toBe(r.active["landing-hero"]);
    expect(r.flags).toEqual({ "promo-banner": true });
  });

  it("keeps an existing assignment (sticky) and doesn't rewrite the cookie", () => {
    const first = evaluate(config([hero]), VID, {}, ctx, "/demo/landing").active["landing-hero"];
    const forced = first === "control" ? "outcome" : "control";
    const r = evaluate(config([hero]), VID, { "landing-hero": forced }, ctx, "/demo/landing/");
    expect(r.active["landing-hero"]).toBe(forced);
    expect(r.changed).toBe(false);
    expect(r.rewrite?.variant).toBe(forced);
  });

  it("only enrolls on the experiment path, but forwards existing assignments everywhere", () => {
    const elsewhere = evaluate(config([hero]), VID, {}, ctx, "/pricing");
    expect(elsewhere.rewrite).toBeNull();
    expect(elsewhere.active).toEqual({});
    expect(elsewhere.changed).toBe(false);
    // "/demo/landingfoo" is not under "/demo/landing"
    expect(evaluate(config([hero]), VID, {}, ctx, "/demo/landingfoo").active).toEqual({});
    // below the path enrolls, but only the exact path is rewritten
    const below = evaluate(config([hero]), VID, {}, ctx, "/demo/landing/faq");
    expect(below.active["landing-hero"]).toBeDefined();
    expect(below.rewrite).toBeNull();
    const returning = evaluate(config([hero]), VID, { "landing-hero": "control" }, ctx, "/pricing");
    expect(returning.active).toEqual({ "landing-hero": "control" });
    expect(returning.rewrite).toBeNull();
  });

  it("drops cookie entries for unknown experiments or removed variants", () => {
    const r = evaluate(config([hero]), VID, { gone: "a", "landing-hero": "deleted-variant" }, ctx, "/demo/landing");
    expect(r.cookieAssignments.gone).toBeUndefined();
    expect(["control", "outcome"]).toContain(r.cookieAssignments["landing-hero"]);
    expect(r.changed).toBe(true);
  });

  it("paused experiments: keeps the cookie, forwards nothing, enrolls nobody", () => {
    const paused = { ...hero, status: "paused" as const };
    const kept = evaluate(config([paused]), VID, { "landing-hero": "outcome" }, ctx, "/demo/landing");
    expect(kept.cookieAssignments).toEqual({ "landing-hero": "outcome" });
    expect(kept.active).toEqual({});
    expect(kept.rewrite).toBeNull();
    expect(evaluate(config([paused]), VID, {}, ctx, "/demo/landing").cookieAssignments).toEqual({});
  });

  it("targeting gates enrollment but not existing assignments", () => {
    const targeted = { ...hero, targeting: { utmSource: "facebook" } };
    expect(evaluate(config([targeted]), VID, {}, ctx, "/demo/landing").active).toEqual({});
    expect(evaluate(config([targeted]), VID, {}, { ...ctx, utmSource: "facebook" }, "/demo/landing").active["landing-hero"]).toBeDefined();
    expect(evaluate(config([targeted]), VID, { "landing-hero": "control" }, ctx, "/demo/landing").active).toEqual({ "landing-hero": "control" });
  });

  it("header-mode experiments are forwarded but never rewrite", () => {
    const header = { ...hero, key: "social-proof", mode: "header" as const };
    const r = evaluate(config([header]), VID, {}, ctx, "/demo/landing");
    expect(r.active["social-proof"]).toBeDefined();
    expect(r.rewrite).toBeNull();
  });
});

describe("directVariantHit", () => {
  it("detects direct visits to a rewrite target", () => {
    expect(directVariantHit(config([hero]), "/demo/landing/outcome")?.key).toBe("landing-hero");
    expect(directVariantHit(config([hero]), "/demo/landing")).toBeNull();
    expect(directVariantHit(config([hero]), "/demo/landing/unknown")).toBeNull();
  });
});

describe("schemas", () => {
  it("rejects duplicate variant keys and zero total weight", () => {
    expect(experimentDefinitionSchema.safeParse({ ...hero, variants: [hero.variants[0], hero.variants[0]] }).success).toBe(false);
    expect(
      experimentDefinitionSchema.safeParse({ ...hero, variants: hero.variants.map((v) => ({ ...v, weight: 0 })) }).success,
    ).toBe(false);
    expect(experimentDefinitionSchema.safeParse({ ...hero, trafficAllocation: 120 }).success).toBe(false);
    expect(edgeConfigSchema.safeParse(config([hero])).success).toBe(true);
  });
});
