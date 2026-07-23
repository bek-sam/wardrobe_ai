import type { GarmentCategory } from "./GarmentArtwork";

export interface WardrobePreviewItem {
  id: string;
  name: string;
  category: GarmentCategory;
  categoryLabel: string;
  color: string;
  accent?: string;
  meta: string;
  status?: "available" | "laundry";
  favorite?: boolean;
}
