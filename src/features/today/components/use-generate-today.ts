import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { generateTodayOutfit } from "./generate-today-outfit";
import type { TodayRecommendation } from "./today.types";

type Deps = {
  aiConfigured: boolean;
  coreLoading: boolean;
  today: string;
  itemsLength: number;
  occasion: string;
  generating: "unsaved" | "saved" | null;
  setGenerating: Dispatch<SetStateAction<"unsaved" | "saved" | null>>;
  setRecommendation: Dispatch<SetStateAction<TodayRecommendation | null>>;
  setGenerationError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  generationAbortRef: MutableRefObject<AbortController | null>;
};

export function useGenerateToday(deps: Deps) {
  return async function generate(saveImmediately: boolean) {
    if (!deps.aiConfigured || deps.coreLoading || deps.generating || !deps.itemsLength) return;
    const requestedOccasion = deps.occasion.trim() || null;
    const controller = new AbortController();
    deps.generationAbortRef.current = controller;
    deps.setGenerating(saveImmediately ? "saved" : "unsaved");
    deps.setGenerationError(null);
    deps.setNotice(null);
    deps.setRecommendation(null);
    try {
      const result = await generateTodayOutfit(
        deps.today,
        requestedOccasion,
        saveImmediately,
        controller.signal,
      );
      deps.setRecommendation(result);
      deps.setNotice(
        result.savedOutfitId
          ? "Today’s outfit was generated and saved."
          : "Today’s outfit is ready. Save it when you want to keep it.",
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      deps.setGenerationError(
        caught instanceof Error ? caught.message : "Today’s outfit could not be generated.",
      );
    } finally {
      if (deps.generationAbortRef.current === controller) deps.generationAbortRef.current = null;
      deps.setGenerating(null);
    }
  };
}
