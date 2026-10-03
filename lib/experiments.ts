/**
 * Typed registry for the experiments and flags this app uses. With this augmentation,
 * `getVariant("landing-hero")` is typed as `"control" | "outcome" | null`.
 */
declare module "./sdk/types" {
  interface ExperimentRegistry {
    "landing-hero": "control" | "outcome";
    "social-proof": "hidden" | "logos";
  }
  interface FlagRegistry {
    "promo-banner": true;
    "new-pricing-table": true;
  }
}

export const LANDING_EXPERIMENTS = ["landing-hero", "social-proof"] as const;
