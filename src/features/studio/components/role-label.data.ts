import type { OutfitItemRole } from "@/features/outfits/types";
import type { OutfitVariantMode } from "@/lib/ai/schemas/outfit-variants";

export const ROLE_LABELS: Record<OutfitItemRole, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  layer: "Layer",
  shoes: "Shoes",
  accessory: "Accessory",
};

export const MODE_LABELS: Record<OutfitVariantMode, string> = {
  safe: "Safe",
  fresh: "Fresh",
  statement: "Statement",
};

export const MODE_DESCRIPTIONS: Record<OutfitVariantMode, string> = {
  safe: "Familiar and dependable",
  fresh: "A balanced change of pace",
  statement: "The most expressive of the three",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Ready to wear",
  laundry: "In the laundry",
  packed: "Packed away",
  loaned: "Loaned out",
  repair: "Being repaired",
};
