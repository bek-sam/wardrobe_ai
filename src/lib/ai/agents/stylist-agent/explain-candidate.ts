import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { EXPLAIN_OUTFIT_PROMPT } from "@/lib/ai/prompts/stylist";
import { explainOutfitCandidateResultSchema } from "@/lib/ai/schemas/stylist";
import { requireEnvironment } from "@/lib/env/server";

import type { ExplainWardrobeCandidateInput } from "./types";

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
    text: {
      format: zodTextFormat(explainOutfitCandidateResultSchema, "wardrobe_outfit_explanation"),
    },
    safety_identifier: input.userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The stylist did not return a valid outfit explanation.");
  }

  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}
