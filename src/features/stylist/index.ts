import { sanitizeNonOutfitAnswer } from "./answers";
import { generatedOutfitSchema } from "@/features/outfits/schemas";
import { z } from "zod";

/**
 * What the stylist workspace can actually do right now.
 *
 * Chat itself only needs an account: the wardrobe-lookup and insight routes
 * answer from the user's own rows and call no model, so the composer stays
 * usable with every OpenAI variable unset. The generation flags gate only the
 * routes that genuinely need a model, and the server still refuses those
 * routes independently -- these flags shape the UI, they do not enforce it.
 */
export type StylistCapabilities = {
  /** The Backend reports that persistent storage is available. */
  chatAvailable: boolean;
  /** The Backend reports outfit orchestration as available. */
  outfitGenerationAvailable: boolean;
  /** The Backend reports planning orchestration as available. */
  planGenerationAvailable: boolean;
};

/** True when at least one model-backed route is configured. */
export function hasGenerationCapability(capabilities: StylistCapabilities) {
  return capabilities.outfitGenerationAvailable || capabilities.planGenerationAvailable;
}

/** True when only the deterministic, zero-model routes are available. */
export function isDeterministicOnly(capabilities: StylistCapabilities) {
  return capabilities.chatAvailable && !hasGenerationCapability(capabilities);
}

export const intents = new Set([
  "packing",
  "planning",
  "insight",
  "item_question",
  "outfit_request",
]);

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function nullableString(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim() ? value.slice(0, maximum) : null;
}

export function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Never carries a signed URL: signed URLs are short-lived and this result can
// be persisted (stylist chat history), so only a stable candidateId + status
// + tags survive sanitization. A viewer fetches a fresh signed URL on demand
// from GET /api/outfit-candidates/[candidateId]/preview.
export function publicPreview(value: unknown) {
  if (!isObject(value)) return null;
  const candidateId = nullableString(value.candidateId, 40);
  if (!candidateId || !uuidPattern.test(candidateId)) return null;
  const status =
    typeof value.status === "string" && previewStatuses.has(value.status) ? value.status : "none";
  const styleTags = Array.isArray(value.styleTags)
    ? value.styleTags
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .slice(0, 5)
        .map((entry) => entry.slice(0, 40))
    : [];
  return { candidateId, status, styleTags };
}

export function publicWeather(value: unknown) {
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
 * Reduces a stored outfit result to fields rendered by the product UI.
 * In particular, resolved database rows, coordinates, traces, and unknown
 * model output are never returned by the conversation-history endpoint.
 */
function sanitizeOutfitResult(value: Record<string, unknown>) {
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

/**
 * Single entry point for everything the stylist may return: an outfit, or one
 * of the non-outfit answers (plan, packing list, insight, item lookup). Each
 * kind is sanitized down to renderable fields; anything else becomes null.
 */
export function sanitizeStylistStructuredResult(value: unknown) {
  if (!isObject(value)) return null;
  if (typeof value.kind === "string" && value.kind !== "outfit") {
    return sanitizeNonOutfitAnswer(value);
  }
  return sanitizeOutfitResult(value);
}

export type SseEvent = { name: string; data: unknown };

export function parseSseBlock(block: string): SseEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") name = value;
    if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  try {
    return { name, data: JSON.parse(data.join("\n")) as unknown };
  } catch {
    throw new Error("The stylist returned an unreadable stream event.");
  }
}

export const stylistRequestSchema = z
  .object({
    message: z.string().trim().min(2).max(2_000),
    conversationId: z.string().uuid().nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().trim().min(2).max(160).nullable().optional(),
    occasion: z.string().trim().min(1).max(120).nullable().optional(),
    targetFormality: z.number().int().min(1).max(5).optional(),
    indoorOutdoor: z.enum(["indoor", "outdoor", "mixed"]).nullable().optional(),
  })
  .strict();

export const generateOutfitRequestSchema = stylistRequestSchema
  .omit({ conversationId: true })
  .extend({ save: z.boolean().default(false) });

export const saveGeneratedOutfitRequestSchema = z
  .object({ generationId: z.string().uuid() })
  .strict();

export const stylistConversationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(12),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const stylistMessageListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(100),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const stylistConversationParamsSchema = z
  .object({ conversationId: z.string().uuid() })
  .strict();

function sseResponseError(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

export async function consumeSse(
  response: Response,
  onEvent: (event: SseEvent) => Promise<void> | void,
) {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(sseResponseError(payload, `The stylist request failed (${response.status}).`));
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("The stylist did not return an event stream.");
  }
  if (!response.body) throw new Error("The stylist response stream is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    while (true) {
      const boundary = buffer.match(/\r?\n\r?\n/);
      if (!boundary || boundary.index === undefined) break;
      const block = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const parsed = parseSseBlock(block);
      if (parsed) await onEvent(parsed);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    if (parsed) await onEvent(parsed);
  }
}
