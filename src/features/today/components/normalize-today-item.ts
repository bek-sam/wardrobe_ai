import { isObject, safeColor, safeString } from "@/lib/api/normalize";
import type { OutfitItemRole } from "@/features/outfits/types";

import { safeNullableString, safeStrings } from "./today-normalize-primitives";
import { outfitRoles, uuidPattern } from "./today-constants.data";
import type { TodayItem } from "./today.types";

export function normalizeItem(value: unknown, expectedId?: string): TodayItem | null {
  if (!isObject(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) return null;
  if (expectedId && value.id !== expectedId) return null;
  const name = safeNullableString(value.name);
  const category = safeNullableString(value.category);
  if (!name || !category) return null;
  return {
    id: value.id,
    name,
    brand: safeNullableString(value.brand),
    category,
    subcategory: safeNullableString(value.subcategory),
    layerRole: outfitRoles.has(value.layer_role as OutfitItemRole)
      ? (value.layer_role as OutfitItemRole)
      : null,
    primaryColor: safeColor(value.primary_color_hex),
    secondaryColor: safeColor(value.secondary_color_hex),
    colorNames: safeStrings(value.color_names, 8),
    availability: safeString(value.availability_status, "unknown"),
    primaryImageUrl: safeNullableString(value.primary_image_url),
    createdAt: safeNullableString(value.created_at),
  };
}
