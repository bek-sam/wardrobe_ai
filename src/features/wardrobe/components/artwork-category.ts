import type { GarmentCategory } from "./GarmentArtwork";

const CATEGORY_TO_ARTWORK: Readonly<Record<string, GarmentCategory>> = {
  bottom: "bottom",
  bottoms: "bottom",
  dress: "dress",
  dresses: "dress",
  layer: "layer",
  outerwear: "layer",
  shoes: "shoes",
  accessory: "accessory",
  accessories: "accessory",
  bags: "accessory",
};

export function artworkCategory(item: {
  layer_role?: string | null;
  category?: string | null;
}): GarmentCategory {
  const role = item.layer_role?.toLowerCase() ?? "";
  const category = item.category?.toLowerCase() ?? "";
  return CATEGORY_TO_ARTWORK[role] ?? CATEGORY_TO_ARTWORK[category] ?? "top";
}
