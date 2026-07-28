import type { AvailabilityStatus, WardrobeItemRole } from "@/features/wardrobe/types";

/** The narrow column set a text lookup needs; never the whole row. */
export type WardrobeSearchRow = {
  id: string;
  name: string;
  brand: string | null;
  product_name: string | null;
  category: string;
  subcategory: string | null;
  layer_role: WardrobeItemRole | null;
  color_names: string[];
  pattern: string | null;
  fit: string | null;
  season_tags: string[];
  occasion_tags: string[];
  availability_status: AvailabilityStatus;
  favorite: boolean;
  wear_count: number;
  last_worn_at: string | null;
};

export type WardrobeSearchMatch = {
  itemId: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  colorNames: string[];
  availability: AvailabilityStatus;
  favorite: boolean;
  wearCount: number;
  lastWornAt: string | null;
  score: number;
};

export type WardrobeSearchResult = {
  matches: WardrobeSearchMatch[];
  matchCount: number;
  scannedCount: number;
};

export const WARDROBE_SEARCH_COLUMNS =
  "id,name,brand,product_name,category,subcategory,layer_role,color_names,pattern,fit,season_tags,occasion_tags,availability_status,favorite,wear_count,last_worn_at";
