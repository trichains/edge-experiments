import type { ExperimentDefinition, FlagDefinition } from "../core/types";

const DAY = 24 * 60 * 60 * 1000;

export interface ExperimentFixture extends ExperimentDefinition {
  startedAt: Date | null;
  endedAt: Date | null;
}

export function experimentFixtures(now = new Date()): ExperimentFixture[] {
  return [
    {
      key: "landing-hero",
      name: "Landing hero: feature vs. outcome headline",
      description:
        "Control leads with the feature list. The challenger leads with the outcome and uses a higher-contrast CTA. Rewritten at the proxy, so each variant is its own route.",
      status: "running",
      trafficAllocation: 100,
      variants: [
        { key: "control", name: "Feature headline", weight: 50 },
        { key: "outcome", name: "Outcome headline + orange CTA", weight: 50 },
      ],
      targeting: {},
      mode: "rewrite",
      path: "/demo/landing",
      primaryGoal: "signup_click",
      startedAt: new Date(now.getTime() - 6 * DAY),
      endedAt: null,
    },
    {
      key: "social-proof",
      name: "Social proof strip under the hero",
      description:
        "Header mode: the page reads the assignment and decides whether to render a strip of customer logos. Only half of the traffic is enrolled.",
      status: "running",
      trafficAllocation: 50,
      variants: [
        { key: "hidden", name: "No strip", weight: 50 },
        { key: "logos", name: "Logo strip", weight: 50 },
      ],
      targeting: {},
      mode: "header",
      path: "/demo/landing",
      primaryGoal: "signup_click",
      startedAt: new Date(now.getTime() - 6 * DAY),
      endedAt: null,
    },
    {
      key: "checkout-guarantee",
      name: "Checkout: money-back guarantee next to the pay button",
      description: "Finished test kept for reference. Results are seeded synthetic data, not real traffic.",
      status: "finished",
      trafficAllocation: 100,
      variants: [
        { key: "control", name: "No guarantee copy", weight: 50 },
        { key: "guarantee", name: "30-day guarantee badge", weight: 50 },
      ],
      targeting: {},
      mode: "header",
      path: "/demo/checkout",
      primaryGoal: "purchase",
      startedAt: new Date(now.getTime() - 34 * DAY),
      endedAt: new Date(now.getTime() - 12 * DAY),
    },
    {
      key: "pricing-annual-default",
      name: "Pricing: annual plan selected by default",
      description: "Draft. Targets desktop visitors coming from Google Ads.",
      status: "draft",
      trafficAllocation: 30,
      variants: [
        { key: "monthly", name: "Monthly selected", weight: 50 },
        { key: "annual", name: "Annual selected", weight: 50 },
      ],
      targeting: { utmSource: "google", utmMedium: "cpc", device: "desktop" },
      mode: "header",
      path: "/demo/pricing",
      primaryGoal: "plan_selected",
      startedAt: null,
      endedAt: null,
    },
  ];
}

export const flagFixtures: FlagDefinition[] = [
  {
    key: "promo-banner",
    description: "Top banner announcing the annual discount on the demo landing page.",
    enabled: true,
    rollout: 100,
    killSwitch: false,
  },
  {
    key: "new-pricing-table",
    description: "Compact three-column pricing table instead of the old two-card layout.",
    enabled: true,
    rollout: 30,
    killSwitch: false,
  },
];

/**
 * Seeded synthetic traffic. Conversion counts are derived from these rates exactly (no sampling)
 * so the seeded dashboards are stable across restarts. Clearly labelled as synthetic in the UI.
 */
export const seededTraffic: Record<string, { visitors: number; rates: Record<string, number> }> = {
  "checkout-guarantee": { visitors: 4000, rates: { control: 0.028, guarantee: 0.042 } },
  "landing-hero": { visitors: 1400, rates: { control: 0.041, outcome: 0.048 } },
};
