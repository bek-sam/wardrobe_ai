import type { WardrobeItem } from "@/features/wardrobe/types";

import { clamp01, normalize } from "./normalize";
import type { CandidateScoringContext } from "./types";

export function scoreOccasion(item: WardrobeItem, context: CandidateScoringContext) {
  const targetTags = new Set((context.occasionTags ?? []).map(normalize));
  let tagScore = 0.65;
  if (targetTags.size > 0) {
    const itemTags = item.occasion_tags.map(normalize);
    tagScore =
      itemTags.length === 0 ? 0.58 : itemTags.some((tag) => targetTags.has(tag)) ? 1 : 0.35;
  }

  let formalityScore = 0.65;
  if (context.targetFormality !== undefined && item.formality_level !== null) {
    formalityScore = clamp01(1 - Math.abs(item.formality_level - context.targetFormality) / 4);
  }
  return tagScore * 0.55 + formalityScore * 0.45;
}
