import type { AvailabilityStatus, WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import type { ClothingConstraints } from "@/lib/weather";

import { resolveWardrobeItemRole } from "./item-role";

export type HardFilterReasonCode =
  "inactive" | "deleted" | "unavailable" | "dress_rule" | "weather" | "image_required";

export interface HardFilterReason {
  code: HardFilterReasonCode;
  message: string;
}

export interface HardFilterContext {
  allowedAvailabilityStatuses?: readonly AvailabilityStatus[];
  requiredOccasionTags?: readonly string[];
  forbiddenTags?: readonly string[];
  minimumFormality?: number;
  maximumFormality?: number;
  weather?: ClothingConstraints;
  requireImage?: boolean;
  itemIdsWithImages?: ReadonlySet<string> | readonly string[];
}

export interface ExcludedWardrobeItem {
  item: WardrobeItem;
  reasons: HardFilterReason[];
}

export interface HardFilterResult {
  eligible: WardrobeItem[];
  excluded: ExcludedWardrobeItem[];
}

const normalizeTag = (tag: string) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

function normalizedTags(item: WardrobeItem) {
  return new Set(
    [...item.occasion_tags, ...item.weather_tags, ...item.season_tags].map(normalizeTag),
  );
}

function weatherReasons(
  item: WardrobeItem,
  role: WardrobeItemRole | null,
  constraints: ClothingConstraints,
): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];
  const tags = normalizedTags(item);

  if (
    item.warmth_level !== null &&
    item.warmth_level > constraints.maximumItemWarmth &&
    role !== "accessory"
  ) {
    reasons.push({ code: "weather", message: "The item is too warm for the forecast." });
  }

  if (
    constraints.rainProtectionRequired &&
    (tags.has("dry_weather_only") || (role === "shoes" && tags.has("rain_unsafe")))
  ) {
    reasons.push({ code: "weather", message: "The item is explicitly unsuitable for rain." });
  }

  if (
    constraints.snowSafeFootwearRequired &&
    role === "shoes" &&
    (tags.has("snow_unsafe") || tags.has("open_toe"))
  ) {
    reasons.push({ code: "weather", message: "The footwear is explicitly unsuitable for snow." });
  }

  if (
    constraints.effectiveMaximumC >= 24 &&
    (tags.has("cold_weather_only") || tags.has("winter_only"))
  ) {
    reasons.push({ code: "weather", message: "The item is restricted to cold weather." });
  }

  if (
    constraints.effectiveMinimumC < 5 &&
    (tags.has("hot_weather_only") || tags.has("summer_only"))
  ) {
    reasons.push({ code: "weather", message: "The item is restricted to warm weather." });
  }

  return reasons;
}

export function getHardFilterReasons(
  item: WardrobeItem,
  context: HardFilterContext = {},
): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];
  if (item.status !== "active") {
    reasons.push({ code: "inactive", message: `The item status is ${item.status}.` });
  }
  if (item.deleted_at !== null) {
    reasons.push({ code: "deleted", message: "The item has been deleted." });
  }

  const allowedAvailability = new Set(context.allowedAvailabilityStatuses ?? ["available"]);
  if (!allowedAvailability.has(item.availability_status)) {
    reasons.push({
      code: "unavailable",
      message: `The item is currently ${item.availability_status}.`,
    });
  }

  if (
    context.minimumFormality !== undefined &&
    item.formality_level !== null &&
    item.formality_level < context.minimumFormality
  ) {
    reasons.push({ code: "dress_rule", message: "The item is below the required formality." });
  }
  if (
    context.maximumFormality !== undefined &&
    item.formality_level !== null &&
    item.formality_level > context.maximumFormality
  ) {
    reasons.push({ code: "dress_rule", message: "The item exceeds the allowed formality." });
  }

  const itemTags = normalizedTags(item);
  const forbiddenTags = (context.forbiddenTags ?? []).map(normalizeTag);
  if (forbiddenTags.some((tag) => itemTags.has(tag))) {
    reasons.push({ code: "dress_rule", message: "The item conflicts with a dress rule." });
  }

  const requiredTags = (context.requiredOccasionTags ?? []).map(normalizeTag);
  const occasionTags = new Set(item.occasion_tags.map(normalizeTag));
  if (
    requiredTags.length > 0 &&
    occasionTags.size > 0 &&
    !requiredTags.some((tag) => occasionTags.has(tag))
  ) {
    reasons.push({ code: "dress_rule", message: "The item is tagged for a different occasion." });
  }

  if (context.weather) {
    reasons.push(...weatherReasons(item, resolveWardrobeItemRole(item), context.weather));
  }

  if (context.requireImage) {
    const imageIds =
      context.itemIdsWithImages instanceof Set
        ? context.itemIdsWithImages
        : new Set(context.itemIdsWithImages ?? []);
    if (!imageIds.has(item.id)) {
      reasons.push({ code: "image_required", message: "This operation requires an item image." });
    }
  }

  return reasons;
}

export function filterWardrobeCandidates(
  items: readonly WardrobeItem[],
  context: HardFilterContext = {},
): HardFilterResult {
  const eligible: WardrobeItem[] = [];
  const excluded: ExcludedWardrobeItem[] = [];

  for (const item of items) {
    const reasons = getHardFilterReasons(item, context);
    if (reasons.length === 0) eligible.push(item);
    else excluded.push({ item, reasons });
  }

  return { eligible, excluded };
}
