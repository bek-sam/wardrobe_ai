import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { EXPLAIN_OUTFIT_PROMPT, STYLIST_PROMPT } from "@/lib/ai/prompts/stylist";
import {
  explainOutfitCandidateResultSchema,
  stylistResultSchema,
  type StylistResult,
} from "@/lib/ai/schemas/stylist";
import { requireEnvironment } from "@/lib/env/server";

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

  const environment = requireEnvironment("OPENAI_STYLIST_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_STYLIST_MODEL,
    instructions: STYLIST_PROMPT,
    input: JSON.stringify({
      request: input.request,
      occasion: input.occasion ?? null,
      weather: input.weather ?? null,
      preferences: input.preferences ?? null,
      recentWear: input.recentWear ?? null,
      candidates: input.candidates,
    }),
    text: { format: zodTextFormat(stylistResultSchema, "wardrobe_outfit") },
    safety_identifier: input.userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The stylist did not return a valid structured outfit.");
  }
  validateOwnedSelection(response.output_parsed, new Set(input.candidates.map(({ id }) => id)));

  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}

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

  const environment = requireEnvironment("OPENAI_STYLIST_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_STYLIST_MODEL,
    instructions: EXPLAIN_OUTFIT_PROMPT,
    input: JSON.stringify({
      request: input.request,
      occasion: input.occasion ?? null,
      weather: input.weather ?? null,
      preferences: input.preferences ?? null,
      recentWear: input.recentWear ?? null,
      items: input.items,
    }),
    text: { format: zodTextFormat(explainOutfitCandidateResultSchema, "wardrobe_outfit_explanation") },
    safety_identifier: input.userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The stylist did not return a valid outfit explanation.");
  }

  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}
