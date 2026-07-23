import { isObject } from "@/lib/api/normalize";
import { requestJson } from "@/lib/api/request";

import { uuidPattern } from "./stylist-constants.data";
import type { useStylistSession } from "./use-stylist-session";

export function useSaveOutfit(session: ReturnType<typeof useStylistSession>) {
  return async function saveOutfit() {
    if (!session.recommendation || session.savedOutfitId) return;
    if (!session.recommendation.generationId) {
      session.setError(
        "This recommendation is missing its secure generation record. Generate it again before saving.",
      );
      return;
    }
    session.setSaving(true);
    session.setError(null);
    try {
      const saved = await requestJson<unknown>("/api/outfits/generated", {
        method: "POST",
        body: JSON.stringify({ generationId: session.recommendation.generationId }),
      });
      if (!isObject(saved) || typeof saved.id !== "string" || !uuidPattern.test(saved.id)) {
        throw new Error("The saved outfit response was invalid.");
      }
      session.setSavedOutfitId(saved.id);
    } catch (caught) {
      session.setError(caught instanceof Error ? caught.message : "The outfit could not be saved.");
    } finally {
      session.setSaving(false);
    }
  };
}
