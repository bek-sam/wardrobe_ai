// Whole-outfit palette classification. Distinct from
// recommendation/color-compatibility.ts, which scores pairwise harmony
// between items for the deterministic 7-key recommendation score. This
// module instead names the *scheme* an entire outfit's color set reads as,
// for the curator's compact per-candidate context.

export { classifyOutfitColorScheme } from "./classify-outfit-color-scheme";
export { describeColorSchemeGuidance } from "./describe-color-scheme-guidance";
export type { ColorHarmonyScheme } from "./color-harmony.types";
