import { useEffect, useMemo, useState } from "react";

import { useOutfitPreview } from "@/features/outfits/hooks/useOutfitPreview";

import { formattedDate } from "./today-dates";
import { useTodayCoreData } from "./use-today-core-data";
import { useTodayGeneration } from "./use-today-generation";

export function useTodayWorkspaceState(aiConfigured: boolean) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const core = useTodayCoreData(reloadVersion);
  const generation = useTodayGeneration({
    aiConfigured,
    coreLoading: core.coreLoading,
    today: core.today,
    itemsLength: core.items.length,
  });
  const preview = useOutfitPreview(
    generation.recommendation?.preview?.candidateId ?? null,
    generation.recommendation?.preview?.status ?? null,
  );

  useEffect(
    () => () => generation.generationAbortRef.current?.abort(),
    [generation.generationAbortRef],
  );

  const recentItems = useMemo(() => core.items.slice(0, 4), [core.items]);
  const dateLabel = formattedDate(core.today, core.profile?.locale ?? "en-US");

  function retryLoad() {
    core.setCoreLoading(true);
    core.setWeatherLoading(true);
    core.setCoreError(null);
    core.setWeatherError(null);
    setReloadVersion((current) => current + 1);
  }

  return { ...core, ...generation, ...preview, recentItems, dateLabel, retryLoad };
}
