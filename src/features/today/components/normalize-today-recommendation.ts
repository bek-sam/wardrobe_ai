import { isObject, safeNumber } from "@/lib/api/normalize";

import { normalizeRecommendationItems } from "./normalize-recommendation-items";
import { normalizePreview } from "./normalize-today-preview";
import { normalizeWeather } from "./normalize-today-weather";
import { savedOutfitId } from "./today-saved-outfit-id";
import { safeNullableString, safeStrings } from "./today-normalize-primitives";
import { uuidPattern } from "./today-constants.data";
import type { NormalizedRecommendation } from "./today.types";

export function normalizeTodayRecommendation(value: unknown): NormalizedRecommendation | null {
  if (!isObject(value) || !isObject(value.outfit)) return null;
  const outfit = value.outfit;
  const title = safeNullableString(outfit.title);
  const explanation = safeNullableString(outfit.explanation);
  const confidence = safeNumber(outfit.confidence, 0, 1);
  if (!title || !explanation || confidence === null || !Array.isArray(outfit.items)) return null;

  const items = normalizeRecommendationItems(outfit.items);
  if (!items) return null;

  return {
    generationId:
      typeof value.generationId === "string" && uuidPattern.test(value.generationId)
        ? value.generationId
        : null,
    title,
    items,
    explanation,
    warnings: safeStrings(outfit.warnings, 10),
    confidence,
    missingCategory: safeNullableString(outfit.missing_category),
    followUpQuestion: safeNullableString(outfit.follow_up_question),
    weather: normalizeWeather(value.weather),
    excludedItemCount:
      typeof value.excludedItemCount === "number" && Number.isInteger(value.excludedItemCount)
        ? Math.max(0, value.excludedItemCount)
        : 0,
    savedOutfitId: savedOutfitId(value.savedOutfit),
    preview: normalizePreview(value.preview),
  };
}
