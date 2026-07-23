import { RecommendationEmptyState } from "./RecommendationEmptyState";
import { RecommendationPanelContent } from "./RecommendationPanelContent";
import type { useStylistWorkspaceState } from "./use-stylist-workspace-state";

export function RecommendationPanel({
  state,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
}) {
  return (
    <aside className="recommendation-panel" aria-labelledby="recommendation-title">
      {!state.session.recommendation ? (
        <RecommendationEmptyState />
      ) : (
        <RecommendationPanelContent state={state} />
      )}
    </aside>
  );
}
