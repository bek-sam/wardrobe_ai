import type { GarmentCategory } from "@/features/wardrobe/components/GarmentArtwork";
import type { OutfitItemRole } from "@/features/outfits/types";

export function artworkCategory(role: OutfitItemRole): GarmentCategory {
  if (role === "bottom") return "bottom";
  if (role === "dress") return "dress";
  if (role === "layer") return "layer";
  if (role === "shoes") return "shoes";
  if (role === "accessory") return "accessory";
  return "top";
}
