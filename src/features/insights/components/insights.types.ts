import type { GarmentCategory } from "@/features/wardrobe/components/GarmentArtwork";

export type Count = { name: string; count: number };

export type InsightItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layer_role: GarmentCategory | null;
  color_names: string[];
  season_tags: string[];
  wear_count: number;
  last_worn_at: string | null;
  purchase_price: number | null;
  currency: string | null;
};

export type Insights = {
  itemCount: number;
  categories: Count[];
  colors: Count[];
  seasonalWear: Count[];
  mostWorn: InsightItem[];
  leastWorn: InsightItem[];
  neverWorn: InsightItem[];
  costPerWear: Array<{ itemId: string; name: string; value: number; currency: string | null }>;
  possibleFoundations: number;
  gapSuggestions: Array<{ role: string; note: string }>;
  overrepresented: Array<{ name: string; count: number; note: string }>;
};
