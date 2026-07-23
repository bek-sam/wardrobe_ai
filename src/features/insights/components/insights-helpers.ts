import type { GarmentCategory } from "@/features/wardrobe/components/GarmentArtwork";

import type { InsightItem } from "./insights.types";

export function artworkCategory(item: InsightItem): GarmentCategory {
  if (item.layer_role) return item.layer_role;
  const category = item.category.toLowerCase();
  if (category.includes("bottom") || category.includes("pant") || category.includes("skirt"))
    return "bottom";
  if (category.includes("dress")) return "dress";
  if (category.includes("outer") || category.includes("layer") || category.includes("jacket"))
    return "layer";
  if (category.includes("shoe")) return "shoes";
  if (category.includes("access") || category.includes("bag")) return "accessory";
  return "top";
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function wearNote(item: InsightItem) {
  if (item.wear_count === 0) return "No recorded wears yet";
  if (!item.last_worn_at)
    return `${item.wear_count} recorded ${item.wear_count === 1 ? "wear" : "wears"}`;
  return `Last worn ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.last_worn_at))}`;
}
