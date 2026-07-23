import type { GarmentCategory } from "@/features/wardrobe/components/GarmentArtwork";

export interface OutfitPiece {
  category: GarmentCategory;
  color: string;
  accent?: string;
}

export interface OutfitPreview {
  id: string;
  name: string;
  occasion: string;
  detail: string;
  pieces: OutfitPiece[];
  favorite?: boolean;
}
