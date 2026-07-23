import type { OutfitPlanProposal } from "@/features/outfits/types";

export function proposalTieBreak(first: OutfitPlanProposal, second: OutfitPlanProposal) {
  return first.id.localeCompare(second.id);
}
