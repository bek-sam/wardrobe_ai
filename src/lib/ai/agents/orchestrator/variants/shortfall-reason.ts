import type { OrchestratorWeather } from "../answers.types";
import type { OutfitVariantsAnswer } from "./variants.types";

/**
 * Honest, actionable copy for "we could not build three genuinely different
 * looks". Saying so is better than relabelling near-duplicates or quietly
 * relaxing a hard constraint to fill the third slot.
 */
export function variantShortfallReason(count: number): string | null {
  if (count >= 3) return null;
  if (count === 0) {
    return "No complete look in your wardrobe fits this request yet. Try a different occasion, or add a few more pieces.";
  }
  return count === 1
    ? "Only one look in your wardrobe genuinely fits this request. Adding more tops, bottoms, or shoes will unlock alternatives."
    : "Only two meaningfully different looks fit this request. A third would repeat most of the same pieces.";
}

/** Nothing fit the request (or the locks). Honest, with no fabricated look. */
export function emptyVariantsAnswer(weather: OrchestratorWeather): OutfitVariantsAnswer {
  return {
    kind: "variants",
    generationId: null,
    variants: [],
    contextSummary: "",
    weather,
    shortfallReason: variantShortfallReason(0),
  };
}
