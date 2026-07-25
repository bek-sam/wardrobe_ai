import type { ValidatedOutfit } from "@/lib/recommendation/outfit-validation";

import { recordWardrobeOrchestratorRun } from "./record-agent-run";
import { summarizeValidatedOutfit } from "./summarize-outfit";
import type { generateRetrievedExplanation } from "./generate-retrieved-explanation";
import type { TryServeRetrievedOutfitInput } from "./types";

type Explanation = Awaited<ReturnType<typeof generateRetrievedExplanation>>["explanation"];

export function recordRetrievedOutfitRun(
  context: TryServeRetrievedOutfitInput,
  explanation: Explanation,
  outfit: ValidatedOutfit,
) {
  const { input, intent, startedAt, environment, weather, retrieved } = context;
  return recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent,
      date: input.date,
      occasion: input.occasion,
      source: "retrieval",
      candidateId: retrieved.candidateId,
    },
    outputSummary: {
      itemIds: retrieved.items.map((item) => item.item_id),
      responseId: explanation.responseId,
      outfit: summarizeValidatedOutfit(outfit),
      weatherContext: weather ?? {},
    },
    model: environment.OPENAI_STYLIST_MODEL ?? "unconfigured",
    latencyMs: Date.now() - startedAt,
    usage: explanation.usage ?? {},
  });
}
