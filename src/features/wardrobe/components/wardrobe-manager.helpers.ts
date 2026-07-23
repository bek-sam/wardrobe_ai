import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";

import { CATEGORY_TO_ROLE } from "./wardrobe-manager.constants";
import type { ItemFormValues } from "./wardrobe-manager.types";

// A database trigger already durably queues a wardrobe compilation job on
// any relevant item change, so this call is purely a latency optimization
// to process it promptly. Safe to ignore if it fails.
export function triggerWardrobeCompile() {
  fetch("/api/wardrobe/compile", { method: "POST" }).catch(() => {});
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function roleForCategory(category: string): WardrobeItemRole | "" {
  return CATEGORY_TO_ROLE[category] ?? "";
}

export function formFromItem(item: WardrobeItem): ItemFormValues {
  return {
    name: item.name,
    category: item.category,
    brand: item.brand ?? "",
    primaryColorHex: item.primary_color_hex ?? "",
    colorNames: item.color_names.join(", "),
    layerRole: item.layer_role ?? "",
    notes: item.notes,
  };
}

export function itemPayload(values: ItemFormValues) {
  return {
    name: values.name.trim(),
    category: values.category,
    brand: values.brand.trim() || null,
    primary_color_hex: values.primaryColorHex || null,
    color_names: values.colorNames
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    layer_role: values.layerRole || null,
    notes: values.notes.trim(),
  };
}
