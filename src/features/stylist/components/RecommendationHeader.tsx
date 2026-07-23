import { Badge } from "@/components/ui/Badge";

import type { Recommendation } from "./stylist.types";

export function RecommendationHeader({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="recommendation-panel__header">
      <div>
        <p className="eyebrow">Recommended from your wardrobe</p>
        <h2 id="recommendation-title">{recommendation.title}</h2>
      </div>
      <Badge tone={recommendation.confidence >= 0.75 ? "sage" : "gold"}>
        {Math.round(recommendation.confidence * 100)}% fit
      </Badge>
    </div>
  );
}
