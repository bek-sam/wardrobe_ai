import { AskDifferentLookButton } from "./AskDifferentLookButton";
import { RecommendationActions } from "./RecommendationActions";
import { RecommendationFeedback } from "./RecommendationFeedback";
import { RecommendationWarnings } from "./RecommendationWarnings";
import { RecommendationWeatherLine } from "./RecommendationWeatherLine";
import type { useStylistWorkspaceState } from "./use-stylist-workspace-state";

export function RecommendationPanelFooter({
  state,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
}) {
  const { session, styling, actions } = state;
  const recommendation = session.recommendation!;
  return (
    <>
      {recommendation.weather ? (
        <RecommendationWeatherLine weather={recommendation.weather} />
      ) : null}
      <RecommendationWarnings recommendation={recommendation} />
      <RecommendationActions
        date={styling.date}
        generationId={recommendation.generationId}
        onPlan={() => void actions.planOutfit()}
        onSave={() => void actions.saveOutfit()}
        planned={session.planned}
        saving={session.saving}
        savedOutfitId={session.savedOutfitId}
      />
      <RecommendationFeedback
        feedback={session.feedback}
        feedbackBusy={session.feedbackBusy}
        generationId={recommendation.generationId}
        onFeedback={(kind) => void actions.sendFeedback(kind)}
        savedOutfitId={session.savedOutfitId}
      />
      <AskDifferentLookButton occasion={styling.occasion} onSetMessage={styling.setMessage} />
    </>
  );
}
