import { generatedOutfitSchema } from "@/features/outfits/schemas";

import { isObject } from "./history-primitives";
import { publicPreview } from "./sanitize-public-preview";
import { publicWeather } from "./sanitize-public-weather";
import { intents, uuidPattern } from "./history-constants.data";

/**
 * Reduces a stored outfit result to fields rendered by the product UI.
 * In particular, resolved database rows, coordinates, traces, and unknown
 * model output are never returned by the conversation-history endpoint.
 */
export function sanitizeOutfitResult(value: Record<string, unknown>) {
  if (!isObject(value.outfit)) return null;
  const outfit = value.outfit;
  const parsedOutfit = generatedOutfitSchema.safeParse({
    title: outfit.title,
    items: outfit.items,
    explanation: outfit.explanation,
    warnings: outfit.warnings,
    confidence: outfit.confidence,
    missing_category: outfit.missing_category,
    follow_up_question: outfit.follow_up_question,
  });
  if (!parsedOutfit.success) return null;

  const intent =
    typeof value.intent === "string" && intents.has(value.intent) ? value.intent : null;
  const generationId =
    typeof value.generationId === "string" && uuidPattern.test(value.generationId)
      ? value.generationId
      : null;
  const excludedItemCount =
    typeof value.excludedItemCount === "number" &&
    Number.isInteger(value.excludedItemCount) &&
    value.excludedItemCount >= 0
      ? value.excludedItemCount
      : 0;

  return {
    kind: "outfit" as const,
    generationId,
    intent,
    answer: parsedOutfit.data.explanation,
    outfit: parsedOutfit.data,
    weather: publicWeather(value.weather),
    excludedItemCount,
    preview: publicPreview(value.preview),
  };
}
