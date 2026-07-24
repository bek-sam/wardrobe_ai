import { confidentOccasionTags } from "@/lib/recommendation";

import { evaluateCandidateRow } from "./evaluate-candidate";
import { fetchCandidatePool } from "./fetch-candidate-pool";
import { selectDiverseCandidates } from "./select-results";
import type {
  EvaluatedCandidate,
  RetrievedOutfitCandidate,
  RetrieveStoredOutfitInput,
} from "./types";

/**
 * Looks for precomputed outfit_candidates rows that fit this request instead
 * of asking the LLM to compose one from scratch. Returns up to 3 diverse,
 * quality-gated alternatives (safest, underused, expressive) ordered with the
 * safest pick first; an empty array means the caller should fall back to full
 * composition.
 */
export async function retrieveStoredOutfitCandidates(
  input: RetrieveStoredOutfitInput,
): Promise<RetrievedOutfitCandidate[]> {
  const pool = await fetchCandidatePool(input);
  if (!pool) return [];

  const requiredOccasionTags = confidentOccasionTags(input.occasionContext);
  const evaluated: EvaluatedCandidate[] = [];
  for (const row of pool.rows) {
    const candidate = evaluateCandidateRow(row, pool.itemsById, input, requiredOccasionTags);
    if (candidate) evaluated.push(candidate);
  }

  const selected = selectDiverseCandidates(evaluated);

  // Deliberately never signs a URL here: a signed URL is short-lived and this
  // result can end up persisted (stylist chat history), so callers that need
  // to display the image fetch a fresh signed URL on demand from
  // GET /api/outfit-candidates/[candidateId]/preview instead. "No preview
  // yet" is represented purely as previewStatus !== 'ready' -- never a
  // synchronous wait; this function makes zero curator or image-generation
  // calls, only reads already-persisted columns.
  return selected.map((candidate) => ({
    candidateId: candidate.candidateId,
    score: candidate.score,
    selectionReason: candidate.selectionReason,
    items: candidate.items,
    resolvedItems: candidate.resolvedItems,
    styleTags: candidate.styleTags,
    previewStatus: candidate.previewStatus,
  }));
}
