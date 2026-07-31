import type { VisualizationGarmentInput } from "@/lib/ai/visualization-provider/types";
import { OUTFIT_VISUALIZATION_PROMPT_VERSION } from "@/lib/visualization";

import { describeGarmentInput } from "./describe-garment";
import { VISUALIZATION_PROMPT_RULES } from "./rules.data";

/**
 * Versioned builder, never a mutable inline string: the version it is paired
 * with (OUTFIT_VISUALIZATION_PROMPT_VERSION) is an input to the freshness
 * hash, so any wording change here must be shipped with a version bump or old
 * images would be wrongly reused.
 */
export function buildOutfitVisualizationPrompt(
  garments: readonly VisualizationGarmentInput[],
  correctionInstructions: readonly string[] = [],
): string {
  const listing = [...garments]
    .sort((first, second) => first.imageNumber - second.imageNumber)
    .map(describeGarmentInput)
    .join("\n");

  const correction = correctionInstructions.length
    ? `\n\nA previous attempt was rejected by an automated fidelity check. Fix exactly these problems while keeping every rule above:\n${correctionInstructions
        .map((instruction) => `- ${instruction}`)
        .join("\n")}`
    : "";

  return `Dress the person from the identity reference in exactly the garments supplied below, for a private wardrobe styling preview.

${listing}

${VISUALIZATION_PROMPT_RULES}${correction}`;
}

export { OUTFIT_VISUALIZATION_PROMPT_VERSION };
