import type { WardrobeItem } from "@/features/wardrobe/types";
import type { ClothingConstraints } from "@/lib/weather";

import type { RecommendationScoreComponents } from "../weights";

export interface CandidatePreferenceContext {
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: ReadonlySet<string> | readonly string[];
  dislikedItemIds?: ReadonlySet<string> | readonly string[];
}

export interface CandidateScoringContext {
  weather?: ClothingConstraints;
  occasionTags?: readonly string[];
  targetFormality?: number;
  preferences?: CandidatePreferenceContext;
  selectedItems?: readonly WardrobeItem[];
  recentlyWornItemIds?: ReadonlySet<string> | readonly string[];
}

export interface CandidateScore {
  itemId: string;
  total: number;
  components: RecommendationScoreComponents;
}
