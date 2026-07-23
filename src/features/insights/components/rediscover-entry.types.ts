import type { GarmentCategory } from "@/features/wardrobe/components/GarmentArtwork";

export type RediscoverEntry = {
  id: string;
  category: GarmentCategory;
  color: string;
  label: string;
  name: string;
  detail: string;
};
