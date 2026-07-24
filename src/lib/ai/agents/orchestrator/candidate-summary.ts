import type { WardrobeItem } from "@/features/wardrobe/types";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

type CandidateItem = Pick<
  WardrobeItem,
  | "id"
  | "name"
  | "category"
  | "subcategory"
  | "layer_role"
  | "color_names"
  | "pattern"
  | "fit"
  | "silhouette"
  | "warmth_level"
  | "formality_level"
  | "occasion_tags"
  | "weather_tags"
>;

export function buildCandidateSummary(item: CandidateItem, score: number) {
  return {
    id: item.id,
    name: item.name,
    role: resolveWardrobeItemRole(item),
    category: item.category,
    colors: item.color_names,
    pattern: item.pattern,
    fit: item.fit,
    silhouette: item.silhouette,
    warmthLevel: item.warmth_level,
    formalityLevel: item.formality_level,
    occasionTags: item.occasion_tags,
    weatherTags: item.weather_tags,
    score,
  };
}

export function buildRecentWear(item: Pick<WardrobeItem, "id" | "wear_count" | "last_worn_at">) {
  return { id: item.id, wearCount: item.wear_count, lastWornAt: item.last_worn_at };
}
