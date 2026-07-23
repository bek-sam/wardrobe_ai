import type { GarmentCategory } from "@/features/wardrobe/components/GarmentArtwork";
import type { OutfitItemRole } from "@/features/outfits/types";

export function artworkCategory(role: OutfitItemRole): GarmentCategory {
  return role;
}
