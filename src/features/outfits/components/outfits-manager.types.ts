import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";

export type OutfitFilter = "all" | "favorite" | "worn" | "ai";

export type OutfitItem = { item_id: string; role: WardrobeItemRole; sort_order: number };

export type OutfitRecord = {
  id: string;
  name: string;
  source: "user" | "ai";
  occasion: string | null;
  explanation: string | null;
  favorite: boolean;
  created_at: string;
  outfit_items: OutfitItem[];
  wear_logs?: Array<{ id: string; worn_at: string }>;
};

export type OutfitListResponse = {
  outfits: OutfitRecord[];
  count: number;
  limit: number;
  offset: number;
};

export type LiveWardrobeItem = WardrobeItem & { primary_image_url?: string | null };

export type WardrobeListResponse = {
  items: LiveWardrobeItem[];
  count: number;
  limit: number;
  offset: number;
};

export type FoundationMode = "separates" | "dress";

export type OutfitSelections = Record<WardrobeItemRole, string>;
