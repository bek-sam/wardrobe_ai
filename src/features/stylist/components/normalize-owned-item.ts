import { isObject, safeColor, safeNullableString, safeString } from "@/lib/api/normalize";
import type { OutfitItemRole } from "@/features/outfits/types";

import { safeStrings } from "./stylist-normalize-primitives";
import { roles, uuidPattern } from "./stylist-constants.data";
import type { OwnedItem } from "./stylist.types";

export function normalizeOwnedItem(value: unknown, expectedId?: string): OwnedItem | null {
  if (!isObject(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) return null;
  if (expectedId && value.id !== expectedId) return null;
  if (value.status !== "active" || value.availability_status !== "available") return null;
  const layerRole = roles.has(value.layer_role as OutfitItemRole)
    ? (value.layer_role as OutfitItemRole)
    : null;
  return {
    id: value.id,
    name: safeString(value.name, "Owned item"),
    category: safeString(value.category, "other"),
    subcategory: safeNullableString(value.subcategory),
    layerRole,
    primaryColor: safeColor(value.primary_color_hex),
    secondaryColor: safeColor(value.secondary_color_hex),
    colorNames: safeStrings(value.color_names, 8),
    brand: safeNullableString(value.brand),
    availability: safeString(value.availability_status, "unknown"),
  };
}
