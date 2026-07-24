import { explainWardrobeCandidate } from "@/lib/ai/agents/stylist-agent";
import { validateGeneratedOutfit } from "@/lib/recommendation/outfit-validation";

import { buildAgentWeatherContext } from "./agent-weather-context";
import { buildCandidateSummary, buildRecentWear } from "./candidate-summary";
import type { TryServeRetrievedOutfitInput } from "./types";

export async function generateRetrievedExplanation({
  input,
  style,
  feedback,
  weather,
  weatherWarning,
  retrieved,
}: TryServeRetrievedOutfitInput) {
  const explanation = await explainWardrobeCandidate({
    userId: input.userId,
    request: input.request,
    occasion: input.occasion,
    weather: buildAgentWeatherContext(weather, input.indoorOutdoor),
    preferences: { ...style, feedback },
    recentWear: retrieved.resolvedItems.map(buildRecentWear),
    items: retrieved.resolvedItems.map((item) => buildCandidateSummary(item, retrieved.score)),
  });

  const validation = validateGeneratedOutfit(
    {
      title: explanation.result.title,
      items: retrieved.items.map(({ item_id, role, sort_order }) => ({
        item_id,
        role,
        sort_order,
      })),
      explanation: explanation.result.explanation,
      warnings: [...(weatherWarning ? [weatherWarning] : []), ...explanation.result.warnings],
      confidence: explanation.result.confidence,
      missing_category: null,
      follow_up_question: null,
    },
    retrieved.resolvedItems,
    { expectedUserId: input.userId },
  );

  return { explanation, validation };
}
