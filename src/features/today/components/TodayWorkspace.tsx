"use client";

import { RecentlyAddedSection } from "./RecentlyAddedSection";
import { TodayAiDisabledBanner } from "./TodayAiDisabledBanner";
import { TodayCoreErrorBanner } from "./TodayCoreErrorBanner";
import { TodayGenerationErrorBanner } from "./TodayGenerationErrorBanner";
import { TodayGrid } from "./TodayGrid";
import { TodayHeader } from "./TodayHeader";
import { TodayRecommendationArea } from "./TodayRecommendationArea";
import { greeting } from "./today-greeting";
import { useTodayWorkspaceState } from "./use-today-workspace-state";

export function TodayWorkspace({ aiConfigured }: { aiConfigured: boolean }) {
  const state = useTodayWorkspaceState(aiConfigured);

  return (
    <div className="page-stack today-page today-page--live">
      <TodayHeader
        dateLabel={state.dateLabel}
        title={state.coreLoading ? "Loading today…" : greeting(state.profile)}
      />
      <TodayCoreErrorBanner error={state.coreError} onRetry={state.retryLoad} />
      <TodayAiDisabledBanner aiConfigured={aiConfigured} />
      <TodayGrid aiConfigured={aiConfigured} state={state} />
      <TodayGenerationErrorBanner error={state.generationError} />
      <TodayRecommendationArea state={state} />
      <RecentlyAddedSection coreLoading={state.coreLoading} recentItems={state.recentItems} />
    </div>
  );
}
