export type InsightItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layer_role: "top" | "bottom" | "dress" | "layer" | "shoes" | "accessory" | null;
  color_names: string[];
  season_tags: string[];
  wear_count: number;
  last_worn_at: string | null;
  purchase_price: number | null;
  currency: string | null;
};
