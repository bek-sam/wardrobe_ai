import { TodayEmptyState } from "./TodayEmptyState";
import { TodayLookSection } from "./TodayLookSection";
import { TodayRecommendationStatus } from "./TodayRecommendationStatus";
import type { useTodayWorkspaceState } from "./use-today-workspace-state";

export function TodayRecommendationArea({
  state,
}: {
  state: ReturnType<typeof useTodayWorkspaceState>;
}) {
  if (state.coreLoading || state.generating) {
    return (
      <TodayRecommendationStatus
        coreLoading={state.coreLoading}
        generating={Boolean(state.generating)}
      />
    );
  }
  if (state.recommendation) {
    return (
      <TodayLookSection
        notice={state.notice}
        onRequestPreview={() => void state.requestPreview()}
        onSave={() => void state.saveRecommendation()}
        previewImageUrl={state.previewImageUrl}
        previewNotice={state.previewNotice}
        previewRequestBusy={state.previewRequestBusy}
        recommendation={state.recommendation}
        recommendationWeather={state.recommendation?.weather ?? state.weather}
        saving={state.saving}
      />
    );
  }
  return <TodayEmptyState coreLoading={state.coreLoading} hasItems={Boolean(state.items.length)} />;
}
