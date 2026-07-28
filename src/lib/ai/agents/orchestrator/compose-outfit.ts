import { after } from "next/server";

import { recordFallbackOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";

import type { OutfitAnswer } from "./answers.types";
import { generateCandidateOutfit } from "./generate-candidate-outfit";
import { recordWardrobeOrchestratorRun } from "./record-agent-run";
import { summarizeValidatedOutfit } from "./summarize-outfit";
import type { ComposeOutfitInput } from "./types";

export async function composeOutfit(composeInput: ComposeOutfitInput): Promise<OutfitAnswer> {
  const { input, intent, startedAt, environment, weather } = composeInput;
  const { candidates, agent, validation } = await generateCandidateOutfit(composeInput);

  const generationId = await recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent,
      date: input.date,
      occasion: input.occasion,
      candidateCount: candidates.items.length,
      source: "composition",
    },
    outputSummary: {
      itemIds: agent.result.itemIds,
      responseId: agent.responseId,
      outfit: summarizeValidatedOutfit(validation.outfit),
      weatherContext: weather ?? {},
    },
    model: environment.OPENAI_STYLIST_MODEL ?? "unconfigured",
    latencyMs: Date.now() - startedAt,
    usage: agent.usage ?? {},
  });

  after(() =>
    recordFallbackOutfitCandidate({
      userId: input.userId,
      occasion: input.occasion,
      items: validation.outfit.items,
    }),
  );

  return {
    kind: "outfit",
    generationId,
    intent,
    answer: validation.outfit.explanation,
    outfit: validation.outfit,
    weather,
    excludedItemCount: candidates.excluded.length,
    // A freshly composed outfit has no library candidate at response time
    // (recordFallbackOutfitCandidate creates one afterward, best-effort, via
    // after()), so there is nothing yet to attach a preview reference to.
    preview: null,
  };
}
