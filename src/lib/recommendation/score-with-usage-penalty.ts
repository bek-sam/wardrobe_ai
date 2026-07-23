import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";

export function scoreWithUsagePenalty(
  proposal: OutfitPlanProposal,
  candidateMap: ReadonlyMap<string, WardrobeItem>,
  selectedUsage: ReadonlyMap<string, number>,
) {
  const penalties = proposal.item_ids.map((itemId) => {
    const historicalWear = Math.min(candidateMap.get(itemId)?.wear_count ?? 0, 25) / 25;
    const plannedUse = selectedUsage.get(itemId) ?? 0;
    return historicalWear * 0.08 + plannedUse * 0.14;
  });
  const usagePenalty = penalties.reduce((total, penalty) => total + penalty, 0) / penalties.length;
  return proposal.base_score - usagePenalty;
}
