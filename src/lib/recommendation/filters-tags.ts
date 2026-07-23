import type { WardrobeItem } from "@/features/wardrobe/types";

export const normalizeTag = (tag: string) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

export function normalizedTags(item: WardrobeItem) {
  return new Set(
    [...item.occasion_tags, ...item.weather_tags, ...item.season_tags].map(normalizeTag),
  );
}
