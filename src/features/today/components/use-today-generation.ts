import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { useGenerateToday } from "./use-generate-today";
import { useSaveTodayRecommendation } from "./use-save-today-recommendation";
import type { TodayRecommendation } from "./today.types";

type Args = { aiConfigured: boolean; coreLoading: boolean; today: string; itemsLength: number };

export function useTodayGeneration({ aiConfigured, coreLoading, today, itemsLength }: Args) {
  const generationAbortRef = useRef<AbortController | null>(null);
  const [occasion, setOccasion] = useState("");
  const [recommendation, setRecommendation] = useState<TodayRecommendation | null>(null);
  const [generating, setGenerating] = useState<"unsaved" | "saved" | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const savedState = useSaveTodayRecommendation(
    recommendation,
    setRecommendation,
    setGenerationError,
    setNotice,
  );
  const generate = useGenerateToday({
    aiConfigured,
    coreLoading,
    today,
    itemsLength,
    occasion,
    generating,
    setGenerating,
    setRecommendation,
    setGenerationError,
    setNotice,
    generationAbortRef,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void generate(false);
  };

  return {
    occasion,
    setOccasion,
    recommendation,
    generating,
    generationError,
    notice,
    generate,
    submit,
    generationAbortRef,
    ...savedState,
  };
}
