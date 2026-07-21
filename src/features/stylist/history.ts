import { generatedOutfitSchema } from "@/features/outfits/schemas";

const intents = new Set(["packing", "planning", "insight", "item_question", "outfit_request"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim() ? value.slice(0, maximum) : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function publicWeather(value: unknown) {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : {};
  const location = isObject(value.location) ? value.location : {};
  const constraints = isObject(value.constraints) ? value.constraints : {};
  const tags = Array.isArray(constraints.tags)
    ? constraints.tags
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .slice(0, 12)
        .map((entry) => entry.slice(0, 80))
    : [];

  return {
    date:
      typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null,
    location: { name: nullableString(location.name, 160) },
    snapshot: {
      temperatureC: nullableNumber(snapshot.temperatureC),
      feelsLikeC: nullableNumber(snapshot.feelsLikeC),
      minimumTemperatureC: nullableNumber(snapshot.minimumTemperatureC),
      maximumTemperatureC: nullableNumber(snapshot.maximumTemperatureC),
      precipitationProbability: nullableNumber(snapshot.precipitationProbability),
      precipitationMm: nullableNumber(snapshot.precipitationMm),
      snowfallCm: nullableNumber(snapshot.snowfallCm),
      windSpeedKph: nullableNumber(snapshot.windSpeedKph),
      humidityPercent: nullableNumber(snapshot.humidityPercent),
      spansDayAndNight:
        typeof snapshot.spansDayAndNight === "boolean" ? snapshot.spansDayAndNight : null,
    },
    constraints: { tags },
  };
}

/**
 * Reduces a stored orchestrator result to fields rendered by the product UI.
 * In particular, resolved database rows, coordinates, traces, and unknown
 * model output are never returned by the conversation-history endpoint.
 */
export function sanitizeStylistStructuredResult(value: unknown) {
  if (!isObject(value) || !isObject(value.outfit)) return null;
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
    generationId,
    intent,
    outfit: parsedOutfit.data,
    weather: publicWeather(value.weather),
    excludedItemCount,
  };
}
