import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRewrittenUrl, isRewrite } from "next/experimental/testing/server";
import type { EdgeConfig } from "@/lib/core/types";

const CONFIG: EdgeConfig = {
  version: "test",
  generatedAt: new Date().toISOString(),
  experiments: [
    {
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
    },
  ],
  flags: [{ key: "promo-banner", description: "", enabled: true, rollout: 100, killSwitch: false }],
};

const fetchMock = vi.fn(async () => Response.json(CONFIG));

beforeEach(() => {
  vi.resetModules(); // fresh module = empty in-memory config memo
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const load = async () => (await import("@/proxy")).proxy;

describe("proxy.ts", () => {
  it("assigns a new visitor, sets both cookies and rewrites to the variant route", async () => {
    const proxy = await load();
    const res = await proxy(new NextRequest("http://localhost:3102/demo/landing?utm_source=x"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("http://localhost:3102/api/config");

    const vid = res.cookies.get("ex_vid");
    const assignments = res.cookies.get("ex_a");
    expect(vid?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(vid?.maxAge).toBe(60 * 60 * 24 * 365);
    expect(vid?.sameSite).toBe("lax");
    expect(vid?.httpOnly).toBe(false);
    expect(assignments?.value).toMatch(/^landing-hero:(control|outcome)$/);

    const variant = assignments!.value.split(":")[1];
    expect(isRewrite(res)).toBe(true);
    expect(getRewrittenUrl(res)).toBe(`http://localhost:3102/demo/landing/${variant}?utm_source=x`);
    expect(res.headers.get("x-middleware-request-x-experiments")).toBe(`landing-hero:${variant}`);
    expect(res.headers.get("x-middleware-request-x-flags")).toBe("promo-banner:1");
  });

  it("keeps a returning visitor in their variant without re-setting cookies", async () => {
    const proxy = await load();
    const req = new NextRequest("http://localhost:3102/demo/landing", {
      headers: { cookie: "ex_vid=0f8fad5b-d9cb-469f-a165-70867728950e; ex_a=landing-hero:outcome" },
    });
    const res = await proxy(req);
    expect(getRewrittenUrl(res)).toBe("http://localhost:3102/demo/landing/outcome");
    expect(res.cookies.get("ex_a")).toBeUndefined();
    expect(res.cookies.get("ex_vid")).toBeUndefined();
  });

  it("overwrites spoofed x-experiments headers", async () => {
    const proxy = await load();
    const res = await proxy(
      new NextRequest("http://localhost:3102/", {
        headers: { cookie: "ex_vid=0f8fad5b-d9cb-469f-a165-70867728950e; ex_a=landing-hero:control", "x-experiments": "landing-hero:outcome" },
      }),
    );
    expect(res.headers.get("x-middleware-request-x-experiments")).toBe("landing-hero:control");
  });

  it("shares one config fetch between concurrent requests and memoizes it", async () => {
    const proxy = await load();
    await Promise.all([1, 2, 3].map(() => proxy(new NextRequest("http://localhost:3102/demo/landing"))));
    await proxy(new NextRequest("http://localhost:3102/demo/landing"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not enroll visitors on pages outside the experiment path", async () => {
    const proxy = await load();
    const res = await proxy(new NextRequest("http://localhost:3102/pricing"));
    expect(res.cookies.get("ex_vid")).toBeDefined();
    expect(res.cookies.get("ex_a")).toBeUndefined();
    expect(res.headers.get("x-middleware-request-x-experiments")).toBe("");
  });

  it("redirects direct visits to a variant route", async () => {
    const proxy = await load();
    const res = await proxy(new NextRequest("http://localhost:3102/demo/landing/outcome"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3102/demo/landing");
  });

  it("falls through to the control page when the config can't be loaded", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("down", { status: 503 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const proxy = await load();
    const res = await proxy(new NextRequest("http://localhost:3102/demo/landing"));
    expect(isRewrite(res)).toBe(false);
    expect(res.cookies.get("ex_a")).toBeUndefined();
    expect(JSON.parse(String(warn.mock.calls[0][0])).event).toBe("proxy.config_unavailable");
    // A failure is cached briefly: the next request doesn't hammer /api/config again.
    await proxy(new NextRequest("http://localhost:3102/demo/landing"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
