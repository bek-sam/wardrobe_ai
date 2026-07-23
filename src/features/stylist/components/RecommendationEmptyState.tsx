import { Sparkle } from "@phosphor-icons/react";

export function RecommendationEmptyState() {
  return (
    <div className="recommendation-empty-state">
      <span>
        <Sparkle size={24} />
      </span>
      <p className="eyebrow">Your next look</p>
      <h2 id="recommendation-title">No recommendation yet</h2>
      <p>
        Ask a question to build a look from your authenticated wardrobe. No sample pieces appear in
        this live panel.
      </p>
    </div>
  );
}
