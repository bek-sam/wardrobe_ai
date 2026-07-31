import type { RetrievedOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { OutfitVariantsResult } from "@/lib/ai/schemas/outfit-variants";

import { buildVariantView } from "./build-variant-view";
import { loadItemIdsWithCutout } from "./items-with-cutouts";
import { MODE_ORDER } from "./mode-for-reason.data";
import type { OutfitVariantView } from "./variants.types";

/** Pairs each validated candidate with its explanation and orders safe→statement. */
export async function assembleVariantViews(
  userId: string,
  candidates: readonly RetrievedOutfitCandidate[],
  result: OutfitVariantsResult,
): Promise<OutfitVariantView[]> {
  const explanations = new Map(result.variants.map((variant) => [variant.variantId, variant]));
  const withCutouts = await loadItemIdsWithCutout(
    userId,
    candidates.flatMap((candidate) => candidate.items.map((member) => member.item_id)),
  );

  return candidates
    .map((candidate) =>
      buildVariantView(candidate, explanations.get(candidate.candidateId), withCutouts),
    )
    .sort((first, second) => MODE_ORDER.indexOf(first.mode) - MODE_ORDER.indexOf(second.mode));
}
