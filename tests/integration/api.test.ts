import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getConfig } from "@/app/api/config/route";
import { POST as track } from "@/app/api/track/route";
import { PATCH as patchFlag } from "@/app/api/flags/[key]/route";
import { POST as simulate } from "@/app/api/simulate/route";
import { edgeConfigSchema } from "@/lib/core/types";
import { resetDbForTests } from "@/lib/db/client";
import { getEdgeConfig, getExperiment, getVariantCounts, toDefinition } from "@/lib/server/repo";

const BASE = "http://localhost:3102";
const VID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function trackRequest(body: unknown, cookie: string) {
  return new NextRequest(`${BASE}/api/track`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "text/plain;charset=UTF-8", cookie },
  });
}

async function heroCounts() {
  const row = await getExperiment("landing-hero");
  return getVariantCounts(toDefinition(row!));
}

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_TOKEN;
  await resetDbForTests();
});

afterAll(async () => {
  await resetDbForTests();
});

describe("GET /api/config", () => {
  it("returns the validated edge config with CDN cache headers", async () => {
    const res = await getConfig();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=300");
    expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{8}"$/);

    const body = edgeConfigSchema.parse(await res.json());
    const keys = body.experiments.map((e) => e.key);
    // Only running/paused experiments reach the proxy; drafts and finished ones stay server-side.
    expect(keys).toEqual(["landing-hero", "social-proof"]);
    expect(body.experiments.every((e) => e.status === "running" || e.status === "paused")).toBe(true);
    const hero = body.experiments.find((e) => e.key === "landing-hero")!;
    expect(hero.mode).toBe("rewrite");
    expect(hero.path).toBe("/demo/landing");
    expect(hero.variants.map((v) => v.key)).toEqual(["control", "outcome"]);
    expect(body.flags.map((f) => f.key).sort()).toEqual(["new-pricing-table", "promo-banner"]);
  });

  it("changes version when a flag changes", async () => {
    const before = (await getEdgeConfig()).version;
    const res = await patchFlag(
      new Request(`${BASE}/api/flags/promo-banner`, { method: "PATCH", body: JSON.stringify({ rollout: 50 }) }),
      { params: Promise.resolve({ key: "promo-banner" }) },
    );
    expect(res.status).toBe(200);
    expect((await getEdgeConfig()).version).not.toBe(before);
  });
});

describe("POST /api/track", () => {
  // Browsers store the cookie percent-encoded (Next serializes values with encodeURIComponent),
  // because ";" is not allowed inside a cookie value.
  const cookie = `ex_vid=${VID}; ex_a=${encodeURIComponent("landing-hero:outcome;social-proof:logos")}`;

  it("records an exposure once per visitor per experiment", async () => {
    const before = await heroCounts();
    const first = await track(trackRequest({ type: "exposure", experiments: ["landing-hero", "social-proof"] }, cookie));
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ recorded: 2, matched: 2 });

    const again = await track(trackRequest({ type: "exposure", experiments: ["landing-hero"] }, cookie));
    expect(await again.json()).toEqual({ recorded: 0, matched: 1 });

    const after = await heroCounts();
    expect(after[1].visitors - before[1].visitors).toBe(1);
  });

  it("dedupes the same visitor + goal per experiment", async () => {
    const before = await heroCounts();
    const first = await track(trackRequest({ type: "conversion", goal: "signup_click", props: { placement: "hero" } }, cookie));
    expect(await first.json()).toEqual({ recorded: 2, matched: 2 });
    for (let i = 0; i < 3; i++) {
      const dup = await track(trackRequest({ type: "conversion", goal: "signup_click" }, cookie));
      expect(await dup.json()).toEqual({ recorded: 0, matched: 2 });
    }
    const after = await heroCounts();
    expect(after[1].conversions - before[1].conversions).toBe(1);
    expect(after[0].conversions).toBe(before[0].conversions);
  });

  it("ignores goals that are not the experiment's primary goal", async () => {
    const res = await track(trackRequest({ type: "conversion", goal: "newsletter" }, cookie));
    expect(await res.json()).toEqual({ recorded: 0, matched: 0 });
  });

  it("does not trust variants that don't exist in the config", async () => {
    const res = await track(
      trackRequest({ type: "exposure", experiments: ["landing-hero"] }, `ex_vid=7c9e6679-7425-40de-944b-e07fc1f90ae7; ex_a=landing-hero:made-up`),
    );
    expect(await res.json()).toEqual({ recorded: 0, matched: 0 });
  });

  it("rejects bad input", async () => {
    expect((await track(trackRequest("not json", cookie))).status).toBe(400);
    expect((await track(trackRequest({ type: "conversion", goal: "Bad Goal!" }, cookie))).status).toBe(400);
    expect((await track(trackRequest({ type: "exposure", experiments: ["landing-hero"] }, "ex_vid=not-a-uuid"))).status).toBe(400);
    expect((await track(trackRequest("x".repeat(5000), cookie))).status).toBe(413);
  });
});

describe("POST /api/simulate", () => {
  it("adds synthetic traffic in sandbox mode", async () => {
    const before = await heroCounts();
    const res = await simulate(
      new Request(`${BASE}/api/simulate`, {
        method: "POST",
        body: JSON.stringify({ experimentKey: "landing-hero", visitors: 1000, rates: { control: 0.1, outcome: 0.2 } }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.visitors).toBe(1000);
    const after = await heroCounts();
    expect(after[0].visitors + after[1].visitors - before[0].visitors - before[1].visitors).toBe(1000);
  });

  it("is refused outside sandbox mode", async () => {
    process.env.DATABASE_URL = "postgres://example.invalid/db";
    try {
      const res = await simulate(new Request(`${BASE}/api/simulate`, { method: "POST", body: "{}" }));
      expect(res.status).toBe(403);
    } finally {
      delete process.env.DATABASE_URL;
    }
  });
});

describe("admin protection", () => {
  it("requires the bearer token when ADMIN_TOKEN is set", async () => {
    process.env.ADMIN_TOKEN = "test-token-123";
    try {
      const ctx = { params: Promise.resolve({ key: "promo-banner" }) };
      const denied = await patchFlag(new Request(`${BASE}/api/flags/promo-banner`, { method: "PATCH", body: JSON.stringify({ enabled: false }) }), ctx);
      expect(denied.status).toBe(401);
      const allowed = await patchFlag(
        new Request(`${BASE}/api/flags/promo-banner`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: false }),
          headers: { authorization: "Bearer test-token-123" },
        }),
        { params: Promise.resolve({ key: "promo-banner" }) },
      );
      expect(allowed.status).toBe(200);
    } finally {
      delete process.env.ADMIN_TOKEN;
    }
  });
});
