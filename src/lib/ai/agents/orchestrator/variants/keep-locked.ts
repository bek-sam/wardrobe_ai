import type { RetrievedOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";

/**
 * The lock invariant, enforced deterministically and before any model call: a
 * candidate that does not contain every locked item ID is dropped outright.
 * The model is never given the opportunity to "helpfully" substitute a locked
 * piece, because it never sees a look missing one.
 */
export function keepLockedCandidates(
  candidates: readonly RetrievedOutfitCandidate[],
  lockedItemIds: readonly string[],
): RetrievedOutfitCandidate[] {
  if (lockedItemIds.length === 0) return [...candidates];
  const required = new Set(lockedItemIds);
  return candidates.filter((candidate) => {
    const present = new Set(candidate.items.map((member) => member.item_id));
    return [...required].every((itemId) => present.has(itemId));
  });
}
