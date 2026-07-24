import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import {
  OUTFIT_CURATOR_PROMPT,
  OUTFIT_CURATOR_PROMPT_VERSION,
} from "@/lib/ai/prompts/outfit-curator";
import { outfitCuratorResultSchema } from "@/lib/ai/schemas/outfit-curator";
import { requireEnvironment } from "@/lib/env/server";

import { MAX_CURATOR_INPUT_CANDIDATES } from "./constants.data";
import type { OutfitCuratorAgentInput } from "./types";
import { validateCuratorDecisions } from "./validate-decisions";

export async function runOutfitCuratorAgent(input: OutfitCuratorAgentInput) {
  if (input.candidates.length === 0) {
    throw new Error("No candidates were supplied to the outfit curator.");
  }
  if (input.candidates.length > MAX_CURATOR_INPUT_CANDIDATES) {
    throw new Error(
      `The outfit curator shortlist exceeds the configured limit of ${MAX_CURATOR_INPUT_CANDIDATES}.`,
    );
  }

  const environment = requireEnvironment("OPENAI_CURATOR_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_CURATOR_MODEL,
    instructions: OUTFIT_CURATOR_PROMPT,
    input: JSON.stringify({
      knowledgeVersion: input.knowledgeVersion,
      preferences: input.userPreferences,
      candidates: input.candidates,
    }),
    text: { format: zodTextFormat(outfitCuratorResultSchema, "outfit_curation") },
    safety_identifier: input.userId,
    store: false,
  });
  if (!response.output_parsed) {
    throw new Error("The outfit curator did not return a valid structured result.");
  }
  validateCuratorDecisions(
    response.output_parsed,
    new Set(input.candidates.map((c) => c.candidateId)),
  );

  return {
    result: response.output_parsed,
    responseId: response.id,
    usage: response.usage,
    model: environment.OPENAI_CURATOR_MODEL,
    promptVersion: OUTFIT_CURATOR_PROMPT_VERSION,
  };
}
