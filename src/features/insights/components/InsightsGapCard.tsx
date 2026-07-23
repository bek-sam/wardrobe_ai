import { ButtonLink } from "@/components/ui/Button";

import { GapAnalysisCard } from "./GapAnalysisCard";
import { titleCase } from "./insights-helpers";
import type { Insights } from "./insights.types";

export function InsightsGapCard({ insights }: { insights: Insights }) {
  const gap = insights.gapSuggestions[0];
  const over = insights.overrepresented[0];
  return (
    <GapAnalysisCard
      action={
        <ButtonLink href="/wardrobe" variant="secondary">
          Review wardrobe
        </ButtonLink>
      }
      description={
        gap?.note ??
        over?.note ??
        "Keep recording wears before making purchase or cleanup decisions."
      }
      heading={
        gap
          ? `No ${titleCase(gap.role)} is recorded.`
          : over
            ? `${titleCase(over.name)} is strongly represented.`
            : "No obvious foundation gap yet."
      }
    />
  );
}
