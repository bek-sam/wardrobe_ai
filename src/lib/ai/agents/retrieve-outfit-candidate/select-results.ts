import { differsFromAll, outfitFoundationKey } from "@/lib/recommendation";

import { MAX_RESULTS, RETRIEVAL_MIN_SCORE } from "./constants.data";
import type { EvaluatedCandidate, RetrievedOutfitSelectionReason } from "./types";

type Selected = EvaluatedCandidate & { selectionReason: RetrievedOutfitSelectionReason };

function comparable(candidate: EvaluatedCandidate) {
  const itemIds = candidate.items.map((member) => member.item_id);
  return { itemIds, foundationKey: outfitFoundationKey(itemIds, candidate.resolvedItems) };
}

/**
 * Picks up to three qualifying candidates along three different axes — safest,
 * least-suggested, best preference match — and rejects any pick that is not
 * *meaningfully* different from the ones already chosen. A distinct
 * combination key was never enough on its own: swapping only the scarf
 * produced three near-identical looks wearing three different labels.
 */
export function selectDiverseCandidates(evaluated: readonly EvaluatedCandidate[]): Selected[] {
  const qualifying = evaluated
    .filter((candidate) => candidate.score >= RETRIEVAL_MIN_SCORE)
    .sort(
      (first, second) =>
        (second.curatorPreferred ? 1 : 0) - (first.curatorPreferred ? 1 : 0) ||
        second.score - first.score,
    );
  if (qualifying.length === 0) return [];

  const results: Selected[] = [];
  const chosen: ReturnType<typeof comparable>[] = [];

  function take(candidate: EvaluatedCandidate | undefined, reason: RetrievedOutfitSelectionReason) {
    if (!candidate || results.some((existing) => existing.candidateId === candidate.candidateId)) {
      return false;
    }
    const shape = comparable(candidate);
    if (!differsFromAll(shape, chosen)) return false;
    chosen.push(shape);
    results.push({ ...candidate, selectionReason: reason });
    return true;
  }

  take(qualifying[0], "safest");

  const byUnderused = [...qualifying].sort(
    (first, second) => first.timesSuggested - second.timesSuggested || second.score - first.score,
  );
  for (const candidate of byUnderused) {
    if (results.length >= MAX_RESULTS || take(candidate, "underused")) break;
  }

  const byPreference = [...qualifying].sort(
    (first, second) => second.preferenceMatch - first.preferenceMatch || second.score - first.score,
  );
  for (const candidate of byPreference) {
    if (results.length >= MAX_RESULTS || take(candidate, "expressive")) break;
  }

  return results.slice(0, MAX_RESULTS);
}
