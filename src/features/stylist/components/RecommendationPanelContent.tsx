import { RecommendationCanvas } from "./RecommendationCanvas";
import { RecommendationHeader } from "./RecommendationHeader";
import { RecommendationPanelFooter } from "./RecommendationPanelFooter";
import { RecommendationPiecesList } from "./RecommendationPiecesList";
import { StylistRecommendationPreview } from "./StylistRecommendationPreview";
import type { useStylistWorkspaceState } from "./use-stylist-workspace-state";

export function RecommendationPanelContent({
  state,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
}) {
  const { session, preview, actions } = state;
  const recommendation = session.recommendation!;
  return (
    <>
      <RecommendationHeader recommendation={recommendation} />
      {recommendation.preview ? (
        <StylistRecommendationPreview
          onRequestPreview={() => void preview.requestPreview()}
          preview={recommendation.preview}
          previewImageUrl={preview.previewImageUrl}
          previewNotice={preview.previewNotice}
          previewRequestBusy={preview.previewRequestBusy}
          previewStatus={preview.previewStatus}
        />
      ) : null}
      <RecommendationCanvas recommendation={recommendation} />
      <RecommendationPiecesList
        onSwap={(selection) => void actions.openSwap(selection)}
        recommendation={recommendation}
        savedOutfitId={session.savedOutfitId}
        swapBusy={session.swapBusy}
      />
      <RecommendationPanelFooter state={state} />
    </>
  );
}
