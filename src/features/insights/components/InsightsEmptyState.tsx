import { ChartBar } from "@phosphor-icons/react";

import { ButtonLink } from "@/components/ui/Button";

export function InsightsEmptyState() {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">
        <ChartBar size={25} />
      </span>
      <h2>Insights begin with your wardrobe</h2>
      <p>
        Add a few pieces and record wears to unlock category, palette, usage, and cost-per-wear
        summaries.
      </p>
      <div className="empty-state__action">
        <ButtonLink href="/wardrobe">Add wardrobe pieces</ButtonLink>
      </div>
    </section>
  );
}
