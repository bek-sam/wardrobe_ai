import type { RetrievedOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { VariantInput } from "@/lib/ai/agents/outfit-variants-agent";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

import { MODE_FOR_SELECTION_REASON } from "./mode-for-reason.data";

/**
 * Compact metadata for an already-filtered, already-validated set — never the
 * whole wardrobe and never a raw image. Wear counts are included because the
 * "fresh" mode's whole point is surfacing something under-worn.
 */
export function buildVariantInput(candidate: RetrievedOutfitCandidate): VariantInput {
  const itemsById = new Map(candidate.resolvedItems.map((item) => [item.id, item]));
  return {
    variantId: candidate.candidateId,
    mode: MODE_FOR_SELECTION_REASON[candidate.selectionReason],
    items: candidate.items
      .slice()
      .sort((first, second) => first.sort_order - second.sort_order)
      .flatMap((member) => {
        const item = itemsById.get(member.item_id);
        if (!item) return [];
        return [
          {
            itemId: item.id,
            role: resolveWardrobeItemRole(item) ?? member.role,
            name: item.name,
            category: item.category,
            colors: item.color_names,
            pattern: item.pattern,
            fit: item.fit,
            silhouette: item.silhouette,
            warmthLevel: item.warmth_level,
            formalityLevel: item.formality_level,
            wearCount: item.wear_count,
            lastWornAt: item.last_worn_at,
          },
        ];
      }),
  };
}
