import { runAiTask } from "@/lib/ai/client";
import type { ExplainOutfitCandidateResult, StylistResult } from "@/lib/ai/schemas";

export type StylistCandidate = {
  id: string;
  name: string;
  role: string | null;
  category: string;
  colors: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  warmthLevel: number | null;
  formalityLevel: number | null;
  occasionTags: readonly string[];
  weatherTags: readonly string[];
  score: number;
};

export type StylistAgentInput = {
  userId: string;
  request: string;
  candidates: readonly StylistCandidate[];
  weather?: unknown;
  preferences?: unknown;
  recentWear?: unknown;
  occasion?: string | null;
};

export type ExplainWardrobeCandidateInput = {
  userId: string;
  request: string;
  items: readonly StylistCandidate[];
  weather?: unknown;
  preferences?: unknown;
  recentWear?: unknown;
  occasion?: string | null;
};

/**
 * Lightweight counterpart to runStylistAgent for outfits already selected by
 * retrieval from the precomputed candidate library: asks the model only to
 * write a title/explanation for a fixed item set, not to choose items.
 */
export async function explainWardrobeCandidate(input: ExplainWardrobeCandidateInput) {
  if (input.items.length === 0) {
    throw new Error("No items were supplied to explain.");
  }

  return runAiTask<{
    result: ExplainOutfitCandidateResult;
    responseId: string;
    usage: unknown;
  }>("explain-outfit", input);
}

function validateOwnedSelection(result: StylistResult, candidateIds: ReadonlySet<string>) {
  const uniqueIds = new Set(result.itemIds);
  if (uniqueIds.size !== result.itemIds.length) {
    throw new Error("The stylist returned a duplicate wardrobe item.");
  }
  const invalidIds = result.itemIds.filter((id) => !candidateIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error("The stylist returned an item outside the authenticated candidate set.");
  }
}

export async function runStylistAgent(input: StylistAgentInput) {
  if (input.candidates.length === 0) {
    throw new Error("No eligible wardrobe items are available for this request.");
  }

  const response = await runAiTask<{ result: StylistResult; responseId: string; usage: unknown }>(
    "select-outfit",
    input,
  );
  validateOwnedSelection(response.result, new Set(input.candidates.map(({ id }) => id)));
  return response;
}
