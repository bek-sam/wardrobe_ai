import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { outfitFoundationKey } from "./outfit-foundation-key";
import { proposalTieBreak } from "./proposal-tie-break";
import { scoreWithUsagePenalty } from "./score-with-usage-penalty";

export function selectEligibleProposals(
  remaining: OutfitPlanProposal[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
  count: number,
  maximumFoundationRepeats: number,
) {
  const selected: OutfitPlanProposal[] = [];
  const selectedUsage = new Map<string, number>();
  const foundationUsage = new Map<string, number>();

  while (selected.length < count && remaining.length > 0) {
    const eligible = remaining.filter((proposal) => {
      const foundation = outfitFoundationKey(proposal.item_ids, candidateMap);
      return (
        foundation !== null && (foundationUsage.get(foundation) ?? 0) < maximumFoundationRepeats
      );
    });
    if (eligible.length === 0) break;

    eligible.sort(
      (first, second) =>
        scoreWithUsagePenalty(second, candidateMap, selectedUsage) -
          scoreWithUsagePenalty(first, candidateMap, selectedUsage) ||
        proposalTieBreak(first, second),
    );

    const next = eligible[0];
    if (!next) break;
    selected.push(next);
    for (const itemId of next.item_ids) {
      selectedUsage.set(itemId, (selectedUsage.get(itemId) ?? 0) + 1);
    }
    const foundation = outfitFoundationKey(next.item_ids, candidateMap);
    if (foundation) foundationUsage.set(foundation, (foundationUsage.get(foundation) ?? 0) + 1);
    remaining.splice(remaining.indexOf(next), 1);
  }

  return { selected, selectedUsage, foundationUsage, remaining };
}
