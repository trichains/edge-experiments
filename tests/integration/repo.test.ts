import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { insertEvents, type EventInsert } from "@/lib/db/seed";
import { getVariantCounts } from "@/lib/server/repo";

// An experiment with no seeded traffic, so every count below comes from this file.
const EXP = {
  key: "social-proof",
  primaryGoal: "signup_click",
  variants: [
    { key: "hidden", name: "No strip", weight: 50 },
    { key: "logos", name: "Logo strip", weight: 50 },
  ],
};

const t = (seconds: number) => new Date(Date.UTC(2026, 9, 1, 12, 0, seconds));
const exposure = (visitorId: string, variant: string, at: Date): EventInsert => ({
  experimentKey: EXP.key,
  variant,
  visitorId,
  kind: "exposure",
  goal: "",
  createdAt: at,
});
const conversion = (visitorId: string, variant: string, at: Date, goal = "signup_click"): EventInsert => ({
  experimentKey: EXP.key,
  variant,
  visitorId,
  kind: "conversion",
  goal,
  createdAt: at,
});

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  await resetDbForTests();
  await insertEvents(await getDb(), [
    // v1: exposed to logos, converts afterwards → counts for logos
    exposure("v1", "logos", t(0)),
    conversion("v1", "logos", t(10)),
    // v2: converts without ever being exposed → not counted anywhere
    conversion("v2", "logos", t(5)),
    // v3: exposed to hidden; conversion row claims "logos" → credited to the exposure variant (hidden)
    exposure("v3", "hidden", t(0)),
    conversion("v3", "logos", t(20)),
    // v4: converted before the exposure → not counted
    conversion("v4", "hidden", t(0)),
    exposure("v4", "hidden", t(30)),
    // v5: exposed, converted on another goal → not counted
    exposure("v5", "logos", t(0)),
    conversion("v5", "logos", t(40), "newsletter"),
  ]);
});

afterAll(async () => {
  await resetDbForTests();
});

describe("getVariantCounts", () => {
  it("counts unique exposed visitors and only conversions after exposure, credited to the exposed variant", async () => {
    const counts = await getVariantCounts(EXP);
    expect(counts).toEqual([
      { key: "hidden", name: "No strip", visitors: 2, conversions: 1 },
      { key: "logos", name: "Logo strip", visitors: 2, conversions: 1 },
    ]);
  });

  it("returns zero rows for variants without traffic", async () => {
    const counts = await getVariantCounts({ ...EXP, variants: [...EXP.variants, { key: "extra", name: "Extra", weight: 0 }] });
    expect(counts[2]).toEqual({ key: "extra", name: "Extra", visitors: 0, conversions: 0 });
  });
});
