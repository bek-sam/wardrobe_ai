import { TodayContextForm } from "./TodayContextForm";
import { TodayWeatherCard } from "./TodayWeatherCard";
import type { useTodayWorkspaceState } from "./use-today-workspace-state";

export function TodayGrid({
  state,
  aiConfigured,
}: {
  state: ReturnType<typeof useTodayWorkspaceState>;
  aiConfigured: boolean;
}) {
  return (
    <div className="today-grid">
      <TodayWeatherCard
        error={state.weatherError}
        loading={state.weatherLoading}
        onRetry={state.retryLoad}
        profile={state.profile}
        weather={state.weather}
      />
      <TodayContextForm
        aiConfigured={aiConfigured}
        coreLoading={state.coreLoading}
        generating={state.generating}
        hasItems={Boolean(state.items.length)}
        itemCount={state.itemCount}
        occasion={state.occasion}
        onBuildAndSave={() => void state.generate(true)}
        onOccasion={state.setOccasion}
        onSubmit={state.submit}
      />
    </div>
  );
}
