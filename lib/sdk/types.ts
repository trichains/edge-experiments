import type { Assignments } from "../core/cookie-format";

/**
 * Augment this interface to get typed variant unions:
 *
 *   declare module "@/lib/sdk/types" {
 *     interface ExperimentRegistry { "landing-hero": "control" | "outcome" }
 *   }
 *
 * Unregistered keys fall back to `string`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExperimentRegistry {}

/** Same idea for flags: register known flag keys to get autocomplete and typo protection. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FlagRegistry {}

export type ExperimentKey = keyof ExperimentRegistry extends never ? string : keyof ExperimentRegistry & string;
export type VariantOf<K extends string> = K extends keyof ExperimentRegistry ? ExperimentRegistry[K] : string;
export type FlagKey = keyof FlagRegistry extends never ? string : keyof FlagRegistry & string;

export interface ExperimentsSnapshot {
  visitorId: string | null;
  assignments: Assignments;
  flags: Record<string, boolean>;
}
