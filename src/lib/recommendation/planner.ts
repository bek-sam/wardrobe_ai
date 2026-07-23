import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { dedupeProposals } from "./dedupe-proposals";
import { rejectFoundationLimited } from "./reject-foundation-limited";
import { selectEligibleProposals } from "./select-eligible-proposals";
import type { BalancedPlannerOptions, BalancedPlannerResult } from "./planner.types";

export { outfitCombinationKey } from "./outfit-combination-key";
export { outfitFoundationKey } from "./outfit-foundation-key";
export { hasCompleteOutfitStructure } from "./outfit-structure";
export { getUnavailableItemIds, isOutfitAvailable } from "./outfit-availability";

export function selectBalancedOutfitPlans(
  proposals: readonly OutfitPlanProposal[],
  candidates: readonly WardrobeItem[],
  options: BalancedPlannerOptions,
): BalancedPlannerResult {
  const count = Math.max(0, Math.floor(options.count));
  const requestedFoundationRepeats = options.maximumFoundationRepeats ?? 1;
  if (!Number.isFinite(requestedFoundationRepeats)) {
    throw new Error("maximumFoundationRepeats must be a finite number.");
  }
  const maximumFoundationRepeats = Math.max(1, Math.floor(requestedFoundationRepeats));
  const candidateMap = new Map(candidates.map((item) => [item.id, item]));
  const existingKeys = new Set(
    options.existingCombinationKeys instanceof Set
      ? options.existingCombinationKeys
      : (options.existingCombinationKeys ?? []),
  );

  const { bestByCombination, rejected } = dedupeProposals(
    proposals,
    candidateMap,
    options.allowedAvailabilityStatuses ?? ["available"],
    existingKeys,
  );

  const { selected, selectedUsage, foundationUsage, remaining } = selectEligibleProposals(
    [...bestByCombination.values()],
    candidateMap,
    count,
    maximumFoundationRepeats,
  );

  rejected.push(
    ...rejectFoundationLimited(remaining, candidateMap, foundationUsage, maximumFoundationRepeats),
  );

  return { selected, rejected, usageCounts: selectedUsage };
}
