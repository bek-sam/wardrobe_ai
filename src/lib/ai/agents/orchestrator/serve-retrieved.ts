import { after } from "next/server";

import { classifyWardrobeIntent } from "./classify-intent";
import { generateRetrievedExplanation } from "./generate-retrieved-explanation";
import { recordWardrobeOrchestratorRun } from "./record-agent-run";
import { scheduleRetrievedOutfitFollowUp } from "./schedule-follow-up";
import { summarizeValidatedOutfit } from "./summarize-outfit";
import type { TryServeRetrievedOutfitInput } from "./types";

// Asks the model only to explain an already-selected candidate instead of
// composing a fresh outfit. Returns null (never throws) on any failure so the
// caller can fall back to full composition exactly as if retrieval had found
// nothing.
export async function tryServeRetrievedOutfit(context: TryServeRetrievedOutfitInput) {
  const { input, startedAt, environment, profile, weather, retrieved } = context;
  try {
    const { explanation, validation } = await generateRetrievedExplanation(context);
    if (!validation.success) return null;

    const generationId = await recordWardrobeOrchestratorRun({
      userId: input.userId,
      inputSummary: {
        intent: classifyWardrobeIntent(input.request),
        date: input.date,
        occasion: input.occasion,
        source: "retrieval",
        candidateId: retrieved.candidateId,
      },
      outputSummary: {
        itemIds: retrieved.items.map((item) => item.item_id),
        responseId: explanation.responseId,
        outfit: summarizeValidatedOutfit(validation.outfit),
        weatherContext: weather ?? {},
      },
      model: environment.OPENAI_STYLIST_MODEL ?? "unconfigured",
      latencyMs: Date.now() - startedAt,
      usage: explanation.usage ?? {},
    });

    after(() => scheduleRetrievedOutfitFollowUp({ input, profile, retrieved }));

    return {
      generationId,
      intent: classifyWardrobeIntent(input.request),
      outfit: validation.outfit,
      weather,
      excludedItemCount: 0,
      preview: {
        candidateId: retrieved.candidateId,
        status: retrieved.previewStatus,
        styleTags: retrieved.styleTags,
      },
    };
  } catch {
    return null;
  }
}
