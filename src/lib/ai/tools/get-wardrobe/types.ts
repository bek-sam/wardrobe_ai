import type { ClothingConstraints } from "@/lib/weather";

export interface GetWardrobeCandidatesInput {
  userId: string;
  weather?: ClothingConstraints;
  occasionTags?: readonly string[];
  targetFormality?: number;
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: readonly string[];
  dislikedItemIds?: readonly string[];
}
