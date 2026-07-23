import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { requestJson } from "./today-request";
import { savedOutfitId } from "./today-saved-outfit-id";
import type { TodayRecommendation } from "./today.types";

export function useSaveTodayRecommendation(
  recommendation: TodayRecommendation | null,
  setRecommendation: Dispatch<SetStateAction<TodayRecommendation | null>>,
  setGenerationError: Dispatch<SetStateAction<string | null>>,
  setNotice: Dispatch<SetStateAction<string | null>>,
) {
  const [saving, setSaving] = useState(false);

  async function saveRecommendation() {
    if (!recommendation || recommendation.savedOutfitId || saving) return;
    if (!recommendation.generationId) {
      setGenerationError(
        "This recommendation is missing its secure generation record. Generate it again before saving.",
      );
      return;
    }
    setSaving(true);
    setGenerationError(null);
    setNotice(null);
    try {
      const raw = await requestJson<unknown>("/api/outfits/generated", {
        method: "POST",
        body: JSON.stringify({ generationId: recommendation.generationId }),
      });
      const id = savedOutfitId(raw);
      if (!id) throw new Error("The saved outfit response could not be verified.");
      setRecommendation((current) => (current ? { ...current, savedOutfitId: id } : current));
      setNotice("Today’s outfit was saved.");
    } catch (caught) {
      setGenerationError(
        caught instanceof Error ? caught.message : "Today’s outfit could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return { saving, saveRecommendation };
}
