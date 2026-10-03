import { expect, test, type Page } from "@playwright/test";

async function currentVariant(page: Page): Promise<string> {
  const variant = await page.getByTestId("variant-name").textContent();
  return (variant ?? "").trim();
}

test.describe("edge assignment", () => {
  test("variant is sticky across visits and matches the rendered page", async ({ page, context }) => {
    await page.goto("/demo/landing");
    const first = await currentVariant(page);
    expect(["control", "outcome"]).toContain(first);
    // The server rendered the right variant route behind the same URL (no client-side swap).
    await expect(page.getByTestId(`landing-${first}`)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/demo/landing");

    const cookies = await context.cookies();
    const vid = cookies.find((c) => c.name === "ex_vid");
    const assignments = cookies.find((c) => c.name === "ex_a");
    expect(vid?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(vid?.sameSite).toBe("Lax");
    expect(vid?.httpOnly).toBe(false);
    expect(decodeURIComponent(assignments?.value ?? "")).toContain(`landing-hero:${first}`);

    await page.goto("/demo/landing");
    expect(await currentVariant(page)).toBe(first);
    await page.reload();
    expect(await currentVariant(page)).toBe(first);
  });

  test("first response HTML already contains the assigned variant (no flicker)", async ({ request }) => {
    const res = await request.get("/demo/landing");
    const html = await res.text();
    const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).join("\n");
    const match = /ex_a=([^;]+)/.exec(setCookie);
    expect(match).not.toBeNull();
    const variant = /landing-hero(?::|%3A)(control|outcome)/.exec(match![1])![1];
    expect(html).toContain(`data-testid="landing-${variant}"`);
  });

  test("switch variant link clears the cookies and issues a new visitor id", async ({ page, context }) => {
    await page.goto("/demo/landing");
    const before = (await context.cookies()).find((c) => c.name === "ex_vid")?.value;
    const seen = new Set([await currentVariant(page)]);

    // Bucketing is random per visitor id, so try a few times; with a 50/50 split the chance of
    // seeing the same variant 12 times in a row is 1 in 4096.
    for (let i = 0; i < 12 && seen.size < 2; i++) {
      await page.getByTestId("switch-variant").click();
      await page.waitForURL("**/demo/landing");
      seen.add(await currentVariant(page));
    }
    const after = (await context.cookies()).find((c) => c.name === "ex_vid")?.value;
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    expect(seen.size).toBe(2);
  });

  test("direct visits to a variant route are redirected to the public path", async ({ page }) => {
    await page.goto("/demo/landing/outcome");
    expect(new URL(page.url()).pathname).toBe("/demo/landing");
  });
});

test.describe("tracking", () => {
  // sendBeacon bodies are not exposed to Playwright, so assert on the server's answer instead:
  // /api/track replies with how many events matched the visitor's assignments.
  test("page view sends an exposure beacon and the CTA sends a conversion", async ({ page }) => {
    const exposure = page.waitForResponse((r) => r.url().endsWith("/api/track") && r.request().method() === "POST");
    await page.goto("/demo/landing");
    const exposureRes = await exposure;
    expect(exposureRes.status()).toBe(202);
    expect((await exposureRes.json()).matched).toBeGreaterThanOrEqual(1);

    const conversion = page.waitForResponse((r) => r.url().endsWith("/api/track") && r.request().method() === "POST");
    await page.getByTestId("cta").click();
    const conversionRes = await conversion;
    expect(conversionRes.status()).toBe(202);
    // landing-hero always matches; social-proof too when the visitor is in its 50% allocation.
    expect((await conversionRes.json()).recorded).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("status").filter({ hasText: "signup_click" })).toBeVisible();
  });
});

test.describe("dashboard", () => {
  test("results page renders stats for landing-hero", async ({ page }) => {
    await page.goto("/dashboard/experiments/landing-hero");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Landing hero");
    const table = page.getByTestId("results-table");
    await expect(table).toContainText("control");
    await expect(table).toContainText("outcome");
    await expect(table).toContainText("%");
    await expect(page.getByTestId("verdict")).toBeVisible();
    await expect(page.getByTestId("sample-size")).toContainText("visitors per variant");
  });

  test("simulate traffic adds visitors", async ({ page }) => {
    await page.goto("/dashboard/experiments/landing-hero");
    await page.getByRole("button", { name: "Simulate traffic" }).click();
    await expect(page.getByRole("status").filter({ hasText: "synthetic visitors" })).toBeVisible();
  });

  test("finished experiment shows a significant result", async ({ page }) => {
    await page.goto("/dashboard/experiments/checkout-guarantee");
    await expect(page.getByTestId("verdict")).toContainText("Significant");
  });

  test("flags page lists flags", async ({ page }) => {
    await page.goto("/dashboard/flags");
    await expect(page.getByTestId("flag-promo-banner")).toBeVisible();
    await expect(page.getByTestId("flag-new-pricing-table")).toContainText("30%");
  });
});
