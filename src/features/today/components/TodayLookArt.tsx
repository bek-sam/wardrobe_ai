import { Badge } from "@/components/ui/Badge";

import { TodayLookPieces } from "./TodayLookPieces";
import type { TodayRecommendation } from "./today.types";

export function TodayLookArt({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <div className="today-look__art">
      <div className="today-look__label">
        <Badge tone={recommendation.savedOutfitId ? "sage" : "rust"}>
          {recommendation.savedOutfitId ? "Saved recommendation" : "Unsaved recommendation"}
        </Badge>
      </div>
      <TodayLookPieces recommendation={recommendation} />
    </div>
  );
}
