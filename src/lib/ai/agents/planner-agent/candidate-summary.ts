import type { WardrobeItem } from "@/features/wardrobe/types";

export function buildPlannerCandidateSummary(item: WardrobeItem) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    role: item.layer_role,
    colors: item.color_names,
    pattern: item.pattern,
    fit: item.fit,
    silhouette: item.silhouette,
    warmthLevel: item.warmth_level,
    formalityLevel: item.formality_level,
    occasions: item.occasion_tags,
    weatherTags: item.weather_tags,
    wearCount: item.wear_count,
    lastWornAt: item.last_worn_at,
  };
}
