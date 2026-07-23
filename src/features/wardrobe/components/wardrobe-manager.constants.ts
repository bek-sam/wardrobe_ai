import type { WardrobeItemRole } from "@/features/wardrobe/types";

import type { ItemFormValues, WardrobeFilters } from "./wardrobe-manager.types";

export const defaultFilters: WardrobeFilters = {
  search: "",
  category: "",
  availability: "",
  itemStatus: "active",
  brand: "",
  color: "",
  season: "",
  occasion: "",
  formality: "",
  favoritesOnly: false,
};

export const CATEGORY_TO_ROLE: Readonly<Record<string, WardrobeItemRole>> = {
  tops: "top",
  bottoms: "bottom",
  dresses: "dress",
  outerwear: "layer",
  shoes: "shoes",
  accessories: "accessory",
  bags: "accessory",
};

export const categoryFilters = [
  { label: "All pieces", value: "" },
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
  { label: "Layers", value: "outerwear" },
  { label: "Shoes", value: "shoes" },
  { label: "Accessories", value: "accessories" },
] as const;

export const categoryOptions = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "bags",
  "activewear",
  "swimwear",
  "underwear",
  "other",
] as const;

export const emptyForm: ItemFormValues = {
  name: "",
  category: "tops",
  brand: "",
  primaryColorHex: "#8b7d6b",
  colorNames: "",
  layerRole: "top",
  notes: "",
};
