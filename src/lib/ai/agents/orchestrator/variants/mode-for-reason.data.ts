import type { OutfitVariantMode } from "@/lib/ai/schemas/outfit-variants";
import type { RetrievedOutfitSelectionReason } from "@/lib/ai/agents/retrieve-outfit-candidate";

/**
 * Retrieval already ranks along exactly the three axes the product needs, so
 * the modes are a presentation label over an existing selection strategy
 * rather than a second, competing ranking.
 */
export const MODE_FOR_SELECTION_REASON: Record<RetrievedOutfitSelectionReason, OutfitVariantMode> =
  {
    safest: "safe",
    underused: "fresh",
    expressive: "statement",
  };

export const MODE_ORDER: readonly OutfitVariantMode[] = ["safe", "fresh", "statement"];
