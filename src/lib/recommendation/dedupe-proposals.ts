import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";

import { isOutfitAvailable } from "./outfit-availability";
import { outfitCombinationKey } from "./outfit-combination-key";
import { outfitFoundationKey } from "./outfit-foundation-key";
import { hasCompleteOutfitStructure } from "./outfit-structure";
import type { PlannerRejection } from "./planner.types";
import { proposalTieBreak } from "./proposal-tie-break";

export function dedupeProposals(
  proposals: readonly OutfitPlanProposal[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
  allowedAvailabilityStatuses: readonly AvailabilityStatus[],
  existingKeys: ReadonlySet<string>,
) {
  const rejected: PlannerRejection[] = [];
  const bestByCombination = new Map<string, OutfitPlanProposal>();

  for (const proposal of proposals) {
    const key = outfitCombinationKey(proposal.item_ids);
    if (existingKeys.has(key)) {
      rejected.push({ proposal, reason: "duplicate_combination" });
      continue;
    }
    if (!isOutfitAvailable(proposal.item_ids, candidateMap, allowedAvailabilityStatuses)) {
      rejected.push({ proposal, reason: "unavailable_item" });
      continue;
    }
    if (!outfitFoundationKey(proposal.item_ids, candidateMap)) {
      rejected.push({ proposal, reason: "invalid_foundation" });
      continue;
    }
    if (!hasCompleteOutfitStructure(proposal.item_ids, candidateMap)) {
      rejected.push({ proposal, reason: "invalid_structure" });
      continue;
    }

    const existing = bestByCombination.get(key);
    if (
      !existing ||
      proposal.base_score > existing.base_score ||
      (proposal.base_score === existing.base_score && proposalTieBreak(proposal, existing) < 0)
    ) {
      if (existing) rejected.push({ proposal: existing, reason: "duplicate_combination" });
      bestByCombination.set(key, proposal);
    } else {
      rejected.push({ proposal, reason: "duplicate_combination" });
    }
  }

  return { bestByCombination, rejected };
}
