import { isObject, safeColor, safeNullableString, safeString } from "@/lib/api/normalize";

import { safeInteger, stringList } from "./import-normalize-primitives";
import type { BoundingBox, CandidateMetadata } from "./import-workspace.types";

export function normalizeMetadata(proposed: unknown, confirmed: unknown): CandidateMetadata {
  const first = isObject(proposed) ? proposed : {};
  const second = isObject(confirmed) ? confirmed : {};
  const merged = { ...first, ...second };
  return {
    name: safeString(merged.name, "Untitled garment"),
    category: safeString(merged.category, "other"),
    subcategory: safeNullableString(merged.subcategory),
    primary_color_hex: safeColor(merged.primary_color_hex),
    secondary_color_hex: safeColor(merged.secondary_color_hex),
    color_names: stringList(merged.color_names),
    pattern: safeNullableString(merged.pattern),
    silhouette: safeNullableString(merged.silhouette),
    materials: isObject(merged.materials) ? merged.materials : {},
    visible_text: stringList(merged.visible_text),
    season_tags: stringList(merged.season_tags),
    occasion_tags: stringList(merged.occasion_tags),
    notes: safeString(merged.notes),
  };
}

export function normalizeBoundingBox(value: unknown): BoundingBox {
  const box = isObject(value) ? value : {};
  return {
    x: safeInteger(box.x, 0, 0, 999),
    y: safeInteger(box.y, 0, 0, 999),
    width: safeInteger(box.width, 1000, 1, 1000),
    height: safeInteger(box.height, 1000, 1, 1000),
  };
}
