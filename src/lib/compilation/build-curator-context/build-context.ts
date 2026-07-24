import type { WardrobeItem } from "@/features/wardrobe/types";
import type { CuratorCandidateInput } from "@/lib/ai/agents/outfit-curator-agent";
import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";

import { buildItemInputs } from "./build-item-inputs";
import { buildStyleKnowledge } from "./build-style-knowledge";
import { deriveItemArrays } from "./derive-item-arrays";
import { orderCandidateItems } from "./order-items";
import { silhouetteBalanceForOutfit } from "./silhouette-balance-for-outfit";
import { warmthToBand } from "./warmth-to-band";

/**
 * Single call site composing style-knowledge functions + deterministic
 * compile-time scores into the compact per-candidate JSON the curator agent
 * sees. No dedup logic lives here -- candidates are already deduplicated and
 * diversified by selectBalancedOutfitPlans() before ever reaching this
 * function.
 */
export function buildCuratorContext(
  candidateDbId: string,
  candidate: GeneratedOutfitCandidate,
  resolvedItems: readonly WardrobeItem[],
  createdItemIds: ReadonlySet<string>,
): CuratorCandidateInput {
  const orderedItems = orderCandidateItems(candidate, resolvedItems);
  const itemArrays = deriveItemArrays(orderedItems);
  const silhouetteBalanced = silhouetteBalanceForOutfit(orderedItems);
  const band = warmthToBand(candidate.warmthLevel);
  const hasRainTag = candidate.weatherTags.includes("rain_safe");

  return {
    candidateId: candidateDbId,
    occasionCategory: candidate.occasionCategory,
    formalityLevel: candidate.formalityLevel,
    warmthLevel: candidate.warmthLevel,
    totalScore: candidate.totalScore,
    colorHarmony: candidate.colorHarmony,
    layeringQuality: candidate.layeringQuality,
    occasionFormality: candidate.occasionFormality,
    preferenceMatch: candidate.preferenceMatch,
    variety: candidate.variety,
    containsNewItem: candidate.items.some((item) => createdItemIds.has(item.itemId)),
    items: buildItemInputs(orderedItems, createdItemIds),
    styleKnowledge: buildStyleKnowledge(
      orderedItems,
      itemArrays,
      silhouetteBalanced,
      band,
      hasRainTag,
    ),
  };
}
