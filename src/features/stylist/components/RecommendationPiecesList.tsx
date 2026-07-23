import { RecommendationPieceItem } from "./RecommendationPieceItem";
import type { OutfitSelection, Recommendation } from "./stylist.types";

export function RecommendationPiecesList({
  recommendation,
  savedOutfitId,
  swapBusy,
  onSwap,
}: {
  recommendation: Recommendation;
  savedOutfitId: string | null;
  swapBusy: boolean;
  onSwap: (selection: OutfitSelection) => void;
}) {
  return (
    <ol className="recommendation-pieces">
      {recommendation.items.map((selection, index) => (
        <RecommendationPieceItem
          detail={recommendation.itemDetails.get(selection.item_id)}
          index={index}
          key={selection.item_id}
          onSwap={() => onSwap(selection)}
          selection={selection}
          showSwap={Boolean(savedOutfitId)}
          swapBusy={swapBusy}
        />
      ))}
    </ol>
  );
}
