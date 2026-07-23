import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

import { artworkCategory } from "./artwork-category";
import type { Recommendation } from "./stylist.types";

export function RecommendationCanvas({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="recommendation-panel__canvas">
      {recommendation.items.map((selection) => {
        const detail = recommendation.itemDetails.get(selection.item_id);
        return (
          <GarmentArtwork
            category={artworkCategory(selection.role)}
            color={detail?.primaryColor ?? "#9c968b"}
            accent={detail?.secondaryColor ?? undefined}
            key={selection.item_id}
          />
        );
      })}
    </div>
  );
}
