import { after } from "next/server";

import type { OutfitAnswer } from "./answers.types";
import { generateRetrievedExplanation } from "./generate-retrieved-explanation";
import { recordRetrievedOutfitRun } from "./record-retrieved-run";
import { scheduleRetrievedOutfitFollowUp } from "./schedule-follow-up";
import type { TryServeRetrievedOutfitInput } from "./types";

// Asks the model only to explain an already-selected candidate instead of
// composing a fresh outfit. Returns null (never throws) on any failure so the
// caller can fall back to full composition exactly as if retrieval had found
// nothing.
export async function tryServeRetrievedOutfit(
  context: TryServeRetrievedOutfitInput,
): Promise<OutfitAnswer | null> {
  const { input, intent, profile, weather, retrieved } = context;
  try {
    const { explanation, validation } = await generateRetrievedExplanation(context);
    if (!validation.success) return null;

    const generationId = await recordRetrievedOutfitRun(context, explanation, validation.outfit);
    after(() => scheduleRetrievedOutfitFollowUp({ input, profile, retrieved }));

    return {
      kind: "outfit",
      generationId,
      intent,
      answer: validation.outfit.explanation,
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
