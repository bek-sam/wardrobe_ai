import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { STYLIST_PROMPT } from "@/lib/ai/prompts/stylist";
import { stylistResultSchema } from "@/lib/ai/schemas/stylist";
import { requireEnvironment } from "@/lib/env/server";

import type { StylistAgentInput } from "./types";
import { validateOwnedSelection } from "./validate-selection";

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
