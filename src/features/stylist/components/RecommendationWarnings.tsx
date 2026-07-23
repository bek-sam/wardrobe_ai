import { Check, WarningCircle } from "@phosphor-icons/react";

import type { Recommendation } from "./stylist.types";

export function RecommendationWarnings({ recommendation }: { recommendation: Recommendation }) {
  if (recommendation.warnings.length || recommendation.missingCategory) {
    return (
      <div className="recommendation-warnings">
        {recommendation.warnings.map((warning) => (
          <p key={warning}>
            <WarningCircle size={14} /> {warning}
          </p>
        ))}
        {recommendation.missingCategory ? (
          <p>
            <WarningCircle size={14} /> Missing category: {recommendation.missingCategory}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="recommendation-note">
      <Check size={16} weight="bold" />
      <p>
        <strong>All pieces verified</strong>
        {recommendation.excludedItemCount} unavailable or unsuitable items were excluded.
      </p>
    </div>
  );
}
