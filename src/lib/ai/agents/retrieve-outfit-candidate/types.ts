import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import type { OccasionContext } from "@/lib/recommendation";
import type { ClothingConstraints } from "@/lib/weather";

export interface RetrievalPreferenceContext {
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: readonly string[];
  dislikedItemIds?: readonly string[];
}

export interface RetrieveStoredOutfitInput {
  userId: string;
  occasionContext: OccasionContext;
  targetFormality?: number;
  weather?: ClothingConstraints;
  preferences?: RetrievalPreferenceContext;
}

export interface RetrievedOutfitCandidateItem {
  item_id: string;
  role: WardrobeItemRole;
  sort_order: number;
}

export type RetrievedOutfitSelectionReason = "safest" | "underused" | "expressive";

export type OutfitPreviewStatus = "none" | "queued" | "generating" | "ready" | "failed";

export interface RetrievedOutfitCandidate {
  candidateId: string;
  score: number;
  selectionReason: RetrievedOutfitSelectionReason;
  items: RetrievedOutfitCandidateItem[];
  resolvedItems: WardrobeItem[];
  styleTags: string[];
  previewStatus: OutfitPreviewStatus;
}

export interface EvaluatedCandidate {
  candidateId: string;
  score: number;
  preferenceMatch: number;
  timesSuggested: number;
  items: RetrievedOutfitCandidateItem[];
  resolvedItems: WardrobeItem[];
  combinationKey: string;
  curatorPreferred: boolean;
  styleTags: string[];
  previewBucket: string | null;
  previewStoragePath: string | null;
  previewStatus: OutfitPreviewStatus;
}
