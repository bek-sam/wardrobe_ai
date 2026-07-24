import { after } from "next/server";

import { recordFallbackOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";

import { classifyWardrobeIntent } from "./classify-intent";
import { generateCandidateOutfit } from "./generate-candidate-outfit";
import { recordWardrobeOrchestratorRun } from "./record-agent-run";
import { summarizeValidatedOutfit } from "./summarize-outfit";
import type { ComposeOutfitInput } from "./types";

export async function composeOutfit(composeInput: ComposeOutfitInput) {
  const { input, startedAt, environment, weather } = composeInput;
  const { candidates, agent, validation } = await generateCandidateOutfit(composeInput);

  const generationId = await recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent: classifyWardrobeIntent(input.request),
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
    generationId,
    intent: classifyWardrobeIntent(input.request),
    outfit: validation.outfit,
    weather,
    excludedItemCount: candidates.excluded.length,
    // A freshly composed outfit has no library candidate at response time
    // (recordFallbackOutfitCandidate creates one afterward, best-effort, via
    // after()), so there is nothing yet to attach a preview reference to.
    preview: null,
  };
}
