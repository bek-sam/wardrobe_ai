import type { OutfitItemRole } from "@/features/outfits/types";
import type { OutfitVariantMode } from "@/lib/ai/schemas/outfit-variants";

export type VariantItemInput = {
  itemId: string;
  role: OutfitItemRole;
  name: string;
  category: string;
  colors: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  warmthLevel: number | null;
  formalityLevel: number | null;
  wearCount: number;
  lastWornAt: string | null;
};

export type VariantInput = {
  variantId: string;
  mode: OutfitVariantMode;
  items: readonly VariantItemInput[];
};

export type OutfitVariantsAgentInput = {
  userId: string;
  request: string;
  occasion: string | null;
  weather: unknown;
  preferences: unknown;
  variants: readonly VariantInput[];
};
