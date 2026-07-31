import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import {
  OUTFIT_VARIANTS_PROMPT,
  OUTFIT_VARIANTS_PROMPT_VERSION,
} from "@/lib/ai/prompts/outfit-variants";
import { outfitVariantsResultSchema } from "@/lib/ai/schemas/outfit-variants";
import { requireEnvironment } from "@/lib/env/server";

import type { OutfitVariantsAgentInput } from "./types";

/**
 * One call for all three looks rather than three calls. Beyond the cost, it is
 * what lets the model actually differentiate them: it can only say what makes
 * "fresh" different from "safe" if it sees both at once.
 */
export async function runOutfitVariantsAgent(input: OutfitVariantsAgentInput) {
  if (input.variants.length === 0) {
    throw new Error("No variants were supplied to explain.");
  }

  const environment = requireEnvironment("OPENAI_STYLIST_MODEL");
  const response = await getOpenAIClient().responses.parse({
    model: environment.OPENAI_STYLIST_MODEL,
    instructions: OUTFIT_VARIANTS_PROMPT,
    input: JSON.stringify({
      request: input.request,
      occasion: input.occasion,
      weather: input.weather,
      preferences: input.preferences,
      variants: input.variants,
    }),
    text: { format: zodTextFormat(outfitVariantsResultSchema, "wardrobe_outfit_variants") },
    safety_identifier: input.userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The stylist did not return valid variant explanations.");
  }
  const supplied = new Set(input.variants.map((variant) => variant.variantId));
  const returned = response.output_parsed.variants.filter((variant) =>
    supplied.has(variant.variantId),
  );

  return {
    result: { ...response.output_parsed, variants: returned },
    responseId: response.id,
    usage: response.usage,
    promptVersion: OUTFIT_VARIANTS_PROMPT_VERSION,
  };
}
