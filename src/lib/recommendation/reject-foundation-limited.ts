import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { outfitFoundationKey } from "./outfit-foundation-key";
import type { PlannerRejection } from "./planner.types";

export function rejectFoundationLimited(
  remaining: readonly OutfitPlanProposal[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
  foundationUsage: ReadonlyMap<string, number>,
  maximumFoundationRepeats: number,
) {
  const rejected: PlannerRejection[] = [];
  for (const proposal of remaining) {
    const foundation = outfitFoundationKey(proposal.item_ids, candidateMap);
    if (foundation && (foundationUsage.get(foundation) ?? 0) >= maximumFoundationRepeats) {
      rejected.push({ proposal, reason: "foundation_repeat_limit" });
    }
  }
  return rejected;
}
