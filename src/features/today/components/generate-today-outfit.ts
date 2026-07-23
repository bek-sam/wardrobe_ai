import { fetchSelectedDetails } from "./fetch-selected-details";
import { normalizeTodayRecommendation } from "./normalize-today-recommendation";
import { requestJson } from "./today-request";
import type { TodayRecommendation } from "./today.types";

export async function generateTodayOutfit(
  today: string,
  occasion: string | null,
  saveImmediately: boolean,
  signal: AbortSignal,
): Promise<TodayRecommendation> {
  const raw = await requestJson<unknown>("/api/outfits/generate", {
    method: "POST",
    body: JSON.stringify({
      message: occasion
        ? `Build a weather-aware outfit from my owned, available wardrobe for ${occasion} today.`
        : "Build a weather-aware outfit from my owned, available wardrobe for today.",
      date: today,
      location: null,
      occasion,
      indoorOutdoor: null,
      save: saveImmediately,
    }),
    signal,
  });
  const normalized = normalizeTodayRecommendation(raw);
  if (!normalized) throw new Error("The stylist returned an invalid recommendation.");
  if (saveImmediately && !normalized.savedOutfitId) {
    throw new Error("The outfit was generated but its saved record could not be verified.");
  }
  const itemDetails = await fetchSelectedDetails(normalized.items, signal);
  return { ...normalized, itemDetails, occasion };
}
