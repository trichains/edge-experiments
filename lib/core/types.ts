import { z } from "zod";

export const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const keySchema = z.string().regex(KEY_PATTERN, "lowercase letters, digits and dashes");

export const experimentStatusSchema = z.enum(["draft", "running", "paused", "finished"]);
export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;

export const variantSchema = z.object({
  key: keySchema,
  name: z.string().min(1).max(80),
  weight: z.number().int().min(0).max(100),
});
export type Variant = z.infer<typeof variantSchema>;

export const targetingSchema = z
  .object({
    utmSource: z.string().min(1).max(100).optional(),
    utmMedium: z.string().min(1).max(100).optional(),
    /** ISO 3166-1 alpha-2 codes, matched against `x-vercel-ip-country`. */
    countries: z.array(z.string().length(2).toUpperCase()).min(1).optional(),
    device: z.enum(["mobile", "desktop"]).optional(),
  })
  .strict();
export type Targeting = z.infer<typeof targetingSchema>;

export const experimentModeSchema = z.enum(["rewrite", "header"]);
export type ExperimentMode = z.infer<typeof experimentModeSchema>;

export const experimentDefinitionSchema = z
  .object({
    key: keySchema,
    name: z.string().min(1).max(120),
    description: z.string().max(500).default(""),
    status: experimentStatusSchema,
    /** Percentage of eligible visitors that enter the experiment (0-100). */
    trafficAllocation: z.number().int().min(0).max(100),
    /** First variant is the control. */
    variants: z.array(variantSchema).min(2).max(6),
    targeting: targetingSchema.default({}),
    mode: experimentModeSchema,
    /**
     * Path the experiment applies to: visitors are only enrolled on requests for this path or below it.
     * In rewrite mode, a request for exactly `path` is rewritten to `path/<variant>`.
     */
    path: z.string().regex(/^\/[a-z0-9\-/]*$/),
    primaryGoal: z.string().regex(/^[a-z0-9_]{1,64}$/),
  })
  .superRefine((exp, ctx) => {
    const keys = new Set(exp.variants.map((v) => v.key));
    if (keys.size !== exp.variants.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "variant keys must be unique" });
    }
    if (exp.variants.reduce((sum, v) => sum + v.weight, 0) <= 0) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "weights must sum to more than 0" });
    }
  });
export type ExperimentDefinition = z.infer<typeof experimentDefinitionSchema>;

export const flagDefinitionSchema = z.object({
  key: keySchema,
  description: z.string().max(300).default(""),
  enabled: z.boolean(),
  /** Percentage of visitors that see the flag on (0-100). */
  rollout: z.number().int().min(0).max(100),
  /** When true the flag is forced off for everyone, regardless of `enabled`/`rollout`. */
  killSwitch: z.boolean().default(false),
});
export type FlagDefinition = z.infer<typeof flagDefinitionSchema>;

/** Shape served by GET /api/config and consumed by proxy.ts. */
export const edgeConfigSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  experiments: z.array(experimentDefinitionSchema),
  flags: z.array(flagDefinitionSchema),
});
export type EdgeConfig = z.infer<typeof edgeConfigSchema>;

export const flagPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    rollout: z.number().int().min(0).max(100).optional(),
    killSwitch: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "nothing to update");

export const trackPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("exposure"),
    experiments: z.array(keySchema).min(1).max(20),
  }),
  z.object({
    type: z.literal("conversion"),
    goal: z.string().regex(/^[a-z0-9_]{1,64}$/),
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
]);
export type TrackPayload = z.infer<typeof trackPayloadSchema>;
