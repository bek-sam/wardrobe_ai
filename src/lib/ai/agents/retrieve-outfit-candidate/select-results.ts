import { MAX_RESULTS, RETRIEVAL_MIN_SCORE } from "./constants.data";
import type { EvaluatedCandidate, RetrievedOutfitSelectionReason } from "./types";

export function selectDiverseCandidates(
  evaluated: readonly EvaluatedCandidate[],
): (EvaluatedCandidate & { selectionReason: RetrievedOutfitSelectionReason })[] {
  const qualifying = evaluated
    .filter((candidate) => candidate.score >= RETRIEVAL_MIN_SCORE)
    .sort(
      (first, second) =>
        (second.curatorPreferred ? 1 : 0) - (first.curatorPreferred ? 1 : 0) ||
        second.score - first.score,
    );
  if (qualifying.length === 0) return [];

  const results: (EvaluatedCandidate & { selectionReason: RetrievedOutfitSelectionReason })[] = [];
  const usedCombinationKeys = new Set<string>();

  function take(candidate: EvaluatedCandidate | undefined, reason: RetrievedOutfitSelectionReason) {
    if (!candidate) return false;
    if (usedCombinationKeys.has(candidate.combinationKey)) return false;
    usedCombinationKeys.add(candidate.combinationKey);
    results.push({ ...candidate, selectionReason: reason });
    return true;
  }

  // Safest: the single highest-scoring qualifying candidate.
  take(qualifying[0], "safest");

  // Underused: the least-suggested qualifying candidate that isn't already picked.
  if (results.length < MAX_RESULTS) {
    const byUnderused = [...qualifying].sort(
      (first, second) => first.timesSuggested - second.timesSuggested || second.score - first.score,
    );
    for (const candidate of byUnderused) {
      if (take(candidate, "underused")) break;
    }
  }

  // Expressive: the candidate whose compile-time preference match scored
  // highest that isn't already picked.
  if (results.length < MAX_RESULTS) {
    const byPreference = [...qualifying].sort(
      (first, second) =>
        second.preferenceMatch - first.preferenceMatch || second.score - first.score,
    );
    for (const candidate of byPreference) {
      if (take(candidate, "expressive")) break;
    }
  }

  return results.slice(0, MAX_RESULTS);
}
