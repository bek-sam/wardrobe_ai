import { isObject, safeNullableString, safeNumber, safeString } from "@/lib/api/normalize";

import { normalizeStylistItems } from "./normalize-recommendation-items";
import { normalizePreview } from "./normalize-stylist-preview";
import { normalizeWeather } from "./normalize-stylist-weather";
import { safeStrings } from "./stylist-normalize-primitives";
import { uuidPattern } from "./stylist-constants.data";
import type { ChatMessage, Recommendation } from "./stylist.types";

export function normalizeRecommendation(
  value: unknown,
): Omit<Recommendation, "itemDetails"> | null {
  if (!isObject(value) || !isObject(value.outfit)) return null;
  const conversationId = safeString(value.conversationId);
  if (!uuidPattern.test(conversationId)) return null;
  const rawGenerationId = safeNullableString(value.generationId);
  const generationId =
    rawGenerationId && uuidPattern.test(rawGenerationId) ? rawGenerationId : null;
  const outfit = value.outfit;
  if (!Array.isArray(outfit.items)) return null;
  const items = normalizeStylistItems(outfit.items);
  if (!items) return null;
  const confidence = safeNumber(outfit.confidence, 0, 1);
  return {
    conversationId,
    generationId,
    title: safeString(outfit.title, "Wardrobe look"),
    items,
    explanation: safeString(outfit.explanation, "Your recommendation is ready."),
    warnings: safeStrings(outfit.warnings, 10),
    confidence: confidence ?? 0,
    missingCategory: safeNullableString(outfit.missing_category),
    followUpQuestion: safeNullableString(outfit.follow_up_question),
    weather: normalizeWeather(value.weather),
    excludedItemCount:
      typeof value.excludedItemCount === "number" && Number.isInteger(value.excludedItemCount)
        ? Math.max(0, value.excludedItemCount)
        : 0,
    preview: normalizePreview(value.preview),
  };
}

export function recommendationFromStoredMessage(message: ChatMessage, conversationId: string) {
  if (!isObject(message.structuredResult)) return null;
  return normalizeRecommendation({ ...message.structuredResult, conversationId });
}
