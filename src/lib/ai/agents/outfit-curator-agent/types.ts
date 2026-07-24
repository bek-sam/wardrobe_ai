import type { WardrobeItemRole } from "@/features/wardrobe/types";
import type { OccasionCategory } from "@/lib/recommendation";
import type { ColorHarmonyScheme } from "@/lib/style-knowledge/color-harmony";
import type { MaterialFormalityTier } from "@/lib/style-knowledge/materials";
import type { StyleArchetype } from "@/lib/style-knowledge/style-archetypes";

export interface CuratorCandidateItemInput {
  itemId: string;
  role: WardrobeItemRole;
  category: string;
  subcategory: string | null;
  colorNames: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  materials: readonly string[];
  isNewItem: boolean;
}

export interface CuratorCandidateInput {
  candidateId: string;
  occasionCategory: OccasionCategory;
  formalityLevel: number | null;
  warmthLevel: number | null;
  totalScore: number;
  colorHarmony: number | null;
  layeringQuality: number | null;
  occasionFormality: number | null;
  preferenceMatch: number | null;
  variety: number | null;
  containsNewItem: boolean;
  items: readonly CuratorCandidateItemInput[];
  styleKnowledge: {
    colorScheme: ColorHarmonyScheme;
    patternMixCompatible: boolean;
    silhouetteBalanced: boolean;
    materialTier: MaterialFormalityTier;
    formalityConsistent: boolean;
    matchedArchetypes: readonly { archetype: StyleArchetype; confidence: number }[];
    weatherGuidance: string;
  };
}

export interface OutfitCuratorAgentInput {
  userId: string;
  candidates: readonly CuratorCandidateInput[];
  userPreferences: {
    styleKeywords: readonly string[];
    styleArchetypes: readonly string[];
    favoriteColors: readonly string[];
    avoidedColors: readonly string[];
  };
  knowledgeVersion: string;
}
