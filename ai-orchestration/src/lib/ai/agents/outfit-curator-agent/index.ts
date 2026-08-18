import type { WardrobeItemRole } from "@/features/wardrobe";
import type { OccasionCategory } from "@/lib/recommendation";
import type { ColorHarmonyScheme } from "@/lib/style-knowledge";
import type { MaterialFormalityTier } from "@/lib/style-knowledge";
import type { StyleArchetype } from "@/lib/style-knowledge/style-archetypes";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { OUTFIT_CURATOR_PROMPT, OUTFIT_CURATOR_PROMPT_VERSION } from "@/lib/ai/prompts";
import { outfitCuratorResultSchema } from "@/lib/ai/schemas";
import { requireEnvironment } from "@/lib/env/server";
import type { OutfitCuratorResult } from "@/lib/ai/schemas";

// Hard cap enforced both by the caller building the shortlist
// (compile-wardrobe.ts) and defensively here, so a caller bug can never turn
// one compile into an unbounded-cost curator call.
export const MAX_CURATOR_INPUT_CANDIDATES = 40;

export interface CuratorCandidateItemInput {
  itemId: string;
  role: WardrobeItemRole;
  category: string;
  subcategory: string | null;
  colorNames: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  materials: readonly string[];
  isNewItem: boolean;
}

export interface CuratorCandidateInput {
  candidateId: string;
  occasionCategory: OccasionCategory;
  formalityLevel: number | null;
  warmthLevel: number | null;
  totalScore: number;
  colorHarmony: number | null;
  layeringQuality: number | null;
  occasionFormality: number | null;
  preferenceMatch: number | null;
  variety: number | null;
  containsNewItem: boolean;
  items: readonly CuratorCandidateItemInput[];
  styleKnowledge: {
    colorScheme: ColorHarmonyScheme;
    patternMixCompatible: boolean;
    silhouetteBalanced: boolean;
    materialTier: MaterialFormalityTier;
    formalityConsistent: boolean;
    matchedArchetypes: readonly { archetype: StyleArchetype; confidence: number }[];
    weatherGuidance: string;
  };
}

export interface OutfitCuratorAgentInput {
  userId: string;
  candidates: readonly CuratorCandidateInput[];
  userPreferences: {
    styleKeywords: readonly string[];
    styleArchetypes: readonly string[];
    favoriteColors: readonly string[];
    avoidedColors: readonly string[];
  };
  knowledgeVersion: string;
}

function validateCuratorDecisions(result: OutfitCuratorResult, candidateIds: ReadonlySet<string>) {
  const ids = result.decisions.map((decision) => decision.candidateId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("The outfit curator returned a duplicate candidate decision.");
  }
  const invalidIds = ids.filter((id) => !candidateIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error("The outfit curator returned a decision outside the authenticated shortlist.");
  }
  const returnedIds = new Set(ids);
  const missingIds = [...candidateIds].filter((id) => !returnedIds.has(id));
  if (missingIds.length > 0) {
    throw new Error("The outfit curator did not return a decision for every candidate.");
  }
}

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
