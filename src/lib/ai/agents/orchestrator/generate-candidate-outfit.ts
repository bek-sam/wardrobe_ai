import { runStylistAgent } from "@/lib/ai/agents/stylist-agent";
import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";

import { buildAgentWeatherContext } from "./agent-weather-context";
import { buildCandidateSummary, buildRecentWear } from "./candidate-summary";
import type { ComposeOutfitInput } from "./types";
import { validateAgentOutfit } from "./validate-agent-outfit";

export async function generateCandidateOutfit({
  input,
  style,
  feedback,
  weather,
  weatherWarning,
}: ComposeOutfitInput) {
  const candidates = await getWardrobeCandidates({
    userId: input.userId,
    weather: weather?.constraints,
    occasionTags: input.occasion ? [input.occasion] : [],
    targetFormality: input.targetFormality ?? style.preferred_formality ?? undefined,
    favoriteColors: style.favorite_colors,
    avoidedColors: style.avoided_colors,
    preferredFits: style.preferred_fits,
    likedItemIds: feedback.likedItemIds,
    dislikedItemIds: feedback.dislikedItemIds,
  });

  const agent = await runStylistAgent({
    userId: input.userId,
    request: input.request,
    occasion: input.occasion,
    weather: buildAgentWeatherContext(weather, input.indoorOutdoor),
    preferences: { ...style, feedback },
    recentWear: candidates.items.map(buildRecentWear),
    candidates: candidates.items.map((item) =>
      buildCandidateSummary(item, candidates.scores.get(item.id)?.total ?? 0),
    ),
  });

  const validation = validateAgentOutfit(agent, candidates.items, input.userId, weatherWarning);
  return { candidates, agent, validation };
}
