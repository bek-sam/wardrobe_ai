import type { WardrobeItemRole } from "@/features/wardrobe/types";

import type { OutfitSelections } from "./outfits-manager.types";

export const roleColors: Record<WardrobeItemRole, { color: string; accent?: string }> = {
  top: { color: "#ddd4c2", accent: "#766e61" },
  bottom: { color: "#293647", accent: "#18202a" },
  dress: { color: "#455746", accent: "#253228" },
  layer: { color: "#9c7250", accent: "#5b412e" },
  shoes: { color: "#292724", accent: "#151412" },
  accessory: { color: "#8c493d", accent: "#5c2c27" },
};

export const emptySelections: OutfitSelections = {
  top: "",
  bottom: "",
  dress: "",
  layer: "",
  shoes: "",
  accessory: "",
};

export const roleOrder: WardrobeItemRole[] = [
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
];

export const roleLabels: Record<WardrobeItemRole, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  layer: "Outer layer",
  shoes: "Shoes",
  accessory: "Accessory",
};
