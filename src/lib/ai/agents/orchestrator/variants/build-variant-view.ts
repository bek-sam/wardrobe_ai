import type { RetrievedOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { OutfitVariantExplanation } from "@/lib/ai/schemas/outfit-variants";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

import { MODE_FOR_SELECTION_REASON } from "./mode-for-reason.data";
import type { OutfitVariantView, VariantItemView } from "./variants.types";

export function buildVariantView(
  candidate: RetrievedOutfitCandidate,
  explanation: OutfitVariantExplanation | undefined,
  itemIdsWithCutout: ReadonlySet<string>,
): OutfitVariantView {
  const itemsById = new Map(candidate.resolvedItems.map((item) => [item.id, item]));
  const items = candidate.items
    .slice()
    .sort((first, second) => first.sort_order - second.sort_order)
    .flatMap((member, index): VariantItemView[] => {
      const item = itemsById.get(member.item_id);
      if (!item) return [];
      return [
        {
          itemId: item.id,
          role: resolveWardrobeItemRole(item) ?? member.role,
          sortOrder: index,
          name: item.name,
          category: item.category,
          colorNames: item.color_names,
          primaryColorHex: item.primary_color_hex,
          pattern: item.pattern,
          availabilityStatus: item.availability_status,
          favorite: item.favorite,
          wearCount: item.wear_count,
        },
      ];
    });

  return {
    mode: MODE_FOR_SELECTION_REASON[candidate.selectionReason],
    candidateId: candidate.candidateId,
    title: explanation?.title ?? "A look from your wardrobe",
    items,
    reasons: explanation?.reasons ?? [],
    warnings: explanation?.warnings ?? [],
    stylistNote: explanation?.stylistNote ?? "",
    confidence: explanation?.confidence ?? 0.5,
    styleTags: candidate.styleTags,
    canVisualize: items.every((item) => itemIdsWithCutout.has(item.itemId)),
  };
}
