/**
 * Two looks are "meaningfully different" when they rest on a different
 * foundation (a different dress, or a different top/bottom pair) or when at
 * most half their pieces overlap. Three labels on near-identical combinations
 * is the failure mode this exists to prevent — a user who sees Safe, Fresh,
 * and Statement should be looking at three real choices.
 */
const MAX_OVERLAP_RATIO = 0.5;

export type DiversityComparable = {
  itemIds: readonly string[];
  foundationKey: string | null;
};

export function outfitOverlapRatio(first: readonly string[], second: readonly string[]): number {
  const firstSet = new Set(first);
  const shared = second.filter((itemId) => firstSet.has(itemId)).length;
  const larger = Math.max(firstSet.size, new Set(second).size);
  return larger === 0 ? 0 : shared / larger;
}

export function isMeaningfullyDifferent(
  candidate: DiversityComparable,
  chosen: DiversityComparable,
): boolean {
  if (
    candidate.foundationKey !== null &&
    chosen.foundationKey !== null &&
    candidate.foundationKey !== chosen.foundationKey
  ) {
    return true;
  }
  return outfitOverlapRatio(candidate.itemIds, chosen.itemIds) <= MAX_OVERLAP_RATIO;
}

/** True only when the candidate differs meaningfully from every prior pick. */
export function differsFromAll(
  candidate: DiversityComparable,
  chosen: readonly DiversityComparable[],
): boolean {
  return chosen.every((existing) => isMeaningfullyDifferent(candidate, existing));
}
