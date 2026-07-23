import { Sparkle } from "@phosphor-icons/react";

import { ButtonLink } from "@/components/ui/Button";

export function TodayEmptyState({
  hasItems,
  coreLoading,
}: {
  hasItems: boolean;
  coreLoading: boolean;
}) {
  return (
    <section className="empty-state today-recommendation-empty" aria-labelledby="today-look-title">
      <span className="empty-state__icon">
        <Sparkle size={25} weight="light" aria-hidden="true" />
      </span>
      <h2 id="today-look-title">
        {hasItems ? "Ready for today’s context" : "Your wardrobe is empty"}
      </h2>
      <p>
        {hasItems
          ? "Choose an occasion above to build a weather-aware look from exact owned item IDs."
          : "Add a few pieces manually or by photo before asking for a recommendation."}
      </p>
      {!hasItems && !coreLoading ? (
        <div className="empty-state__action">
          <ButtonLink href="/wardrobe/import">Add clothes</ButtonLink>
        </div>
      ) : null}
    </section>
  );
}
