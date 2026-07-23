import type { WardrobeItem } from "@/features/wardrobe/types";

import { asSet, clamp01, normalize } from "./normalize";
import type { CandidatePreferenceContext } from "./types";

export function scorePreference(
  item: WardrobeItem,
  preferences: CandidatePreferenceContext | undefined,
) {
  if (!preferences) return item.favorite ? 0.75 : 0.55;
  if (asSet(preferences.dislikedItemIds).has(item.id)) return 0;

  let score = item.favorite ? 0.72 : 0.52;
  if (asSet(preferences.likedItemIds).has(item.id)) score += 0.25;

  const itemColors = new Set(item.color_names.map(normalize));
  const favoriteColors = (preferences.favoriteColors ?? []).map(normalize);
  const avoidedColors = (preferences.avoidedColors ?? []).map(normalize);
  if (favoriteColors.some((color) => itemColors.has(color))) score += 0.18;
  if (avoidedColors.some((color) => itemColors.has(color))) score -= 0.45;

  const preferredFits = (preferences.preferredFits ?? []).map(normalize);
  if (item.fit && preferredFits.includes(normalize(item.fit))) score += 0.12;
  return clamp01(score);
}
