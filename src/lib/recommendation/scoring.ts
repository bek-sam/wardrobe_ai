import type { WardrobeItem } from "@/features/wardrobe/types";
import type { ClothingConstraints } from "@/lib/weather";

import { scoreColorHarmony } from "./color-compatibility";
import { resolveWardrobeItemRole } from "./item-role";
import { analyzeLayering } from "./layering";
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  type RecommendationScoreComponents,
  type RecommendationWeights,
  weightedRecommendationScore,
} from "./weights";

export interface CandidatePreferenceContext {
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: ReadonlySet<string> | readonly string[];
  dislikedItemIds?: ReadonlySet<string> | readonly string[];
}

export interface CandidateScoringContext {
  weather?: ClothingConstraints;
  occasionTags?: readonly string[];
  targetFormality?: number;
  preferences?: CandidatePreferenceContext;
  selectedItems?: readonly WardrobeItem[];
  recentlyWornItemIds?: ReadonlySet<string> | readonly string[];
}

export interface CandidateScore {
  itemId: string;
  total: number;
  components: RecommendationScoreComponents;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const normalize = (value: string) => value.trim().toLowerCase();
const asSet = (values: ReadonlySet<string> | readonly string[] | undefined) =>
  values instanceof Set ? values : new Set(values ?? []);

function scoreWeather(item: WardrobeItem, weather: ClothingConstraints | undefined) {
  if (!weather) return 0.65;

  const role = resolveWardrobeItemRole(item);
  const roleAdjustment = role === "layer" ? 0 : role === "top" || role === "bottom" ? -1 : -0.5;
  const target = Math.max(1, weather.targetWarmthLevel + roleAdjustment);
  let score = item.warmth_level === null ? 0.6 : 1 - Math.abs(item.warmth_level - target) / 4;
  const tags = new Set(item.weather_tags.map(normalize));

  if (weather.rainProtectionRequired && role === "shoes") {
    if (item.water_resistance === "waterproof" || item.water_resistance === "water_resistant") {
      score += 0.15;
    } else if (tags.has("rain_unsafe") || tags.has("dry_weather_only")) {
      score -= 0.5;
    }
  }
  if (weather.breathablePriority && tags.has("breathable")) score += 0.15;
  if (weather.windProtectionRequired && tags.has("windproof")) score += 0.15;
  return clamp01(score);
}

function scoreOccasion(item: WardrobeItem, context: CandidateScoringContext) {
  const targetTags = new Set((context.occasionTags ?? []).map(normalize));
  let tagScore = 0.65;
  if (targetTags.size > 0) {
    const itemTags = item.occasion_tags.map(normalize);
    tagScore =
      itemTags.length === 0 ? 0.58 : itemTags.some((tag) => targetTags.has(tag)) ? 1 : 0.35;
  }

  let formalityScore = 0.65;
  if (context.targetFormality !== undefined && item.formality_level !== null) {
    formalityScore = clamp01(1 - Math.abs(item.formality_level - context.targetFormality) / 4);
  }
  return tagScore * 0.55 + formalityScore * 0.45;
}

function scorePreference(item: WardrobeItem, preferences: CandidatePreferenceContext | undefined) {
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

function scoreVariety(
  item: WardrobeItem,
  recentlyWornItemIds: CandidateScoringContext["recentlyWornItemIds"],
) {
  if (asSet(recentlyWornItemIds).has(item.id)) return 0.2;
  return clamp01(Math.max(0.35, 0.95 - Math.min(item.wear_count, 30) / 40));
}

export function scoreWardrobeCandidate(
  item: WardrobeItem,
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
): CandidateScore {
  const selectedItems = context.selectedItems ?? [];
  const components: RecommendationScoreComponents = {
    weatherSuitability: scoreWeather(item, context.weather),
    occasionFormality: scoreOccasion(item, context),
    colorHarmony: scoreColorHarmony([...selectedItems, item]),
    layeringSilhouette: analyzeLayering([...selectedItems, item]).score,
    explicitPreference: scorePreference(item, context.preferences),
    variety: scoreVariety(item, context.recentlyWornItemIds),
    metadataConfidence: item.metadata_confidence ?? 0.5,
  };

  return {
    itemId: item.id,
    total: weightedRecommendationScore(components, weights),
    components,
  };
}

export function rankWardrobeCandidates(
  items: readonly WardrobeItem[],
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
) {
  return items
    .map((item) => scoreWardrobeCandidate(item, context, weights))
    .sort(
      (first, second) => second.total - first.total || first.itemId.localeCompare(second.itemId),
    );
}
