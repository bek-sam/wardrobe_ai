import type { WardrobeItemRole } from "@/features/wardrobe/types";
import type { CandidatePreferenceContext, OccasionCategory } from "@/lib/recommendation";

export interface CompilationBucket {
  key: OccasionCategory;
  occasionTags: readonly string[];
  targetFormality: number;
}

export interface GeneratedOutfitCandidateItem {
  itemId: string;
  role: WardrobeItemRole;
  sortOrder: number;
}

export interface GeneratedOutfitCandidate {
  combinationKey: string;
  items: GeneratedOutfitCandidateItem[];
  totalScore: number;
  colorHarmony: number;
  layeringQuality: number;
  occasionFormality: number;
  preferenceMatch: number;
  variety: number;
  occasionTags: string[];
  occasionCategory: OccasionCategory;
  weatherTags: string[];
  formalityLevel: number | null;
  warmthLevel: number | null;
  bucketKey: string;
}

export interface GenerateOutfitCandidatesOptions {
  buckets?: readonly CompilationBucket[];
  maxCandidates?: number;
  maxFoundations?: number;
  maxFoundationsPerBucket?: number;
  preferences?: CandidatePreferenceContext;
}
