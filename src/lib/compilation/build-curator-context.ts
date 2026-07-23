import type { WardrobeItem } from "@/features/wardrobe/types";
import type { CuratorCandidateInput } from "@/lib/ai/agents/outfit-curator-agent";
import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";
import {
  classifyMaterialFormality,
  classifyOutfitColorScheme,
  classifySilhouetteWeight,
  evaluateFormalityConsistency,
  evaluatePatternMix,
  evaluateSilhouetteBalance,
  matchStyleArchetypes,
  weatherDressingGuidance,
} from "@/lib/style-knowledge";
import type { TemperatureBand } from "@/lib/weather";

// materials is stored as jsonb (an object or array of unknown shape); this
// flattens whatever the model/user entered into plain keyword strings for
// the style-knowledge material classifiers, which only do keyword matching.
function flattenMaterials(materials: unknown): string[] {
  if (Array.isArray(materials)) {
    return materials.filter((value): value is string => typeof value === "string");
  }
  if (materials && typeof materials === "object") {
    return Object.values(materials).filter((value): value is string => typeof value === "string");
  }
  return [];
}

function warmthToBand(warmthLevel: number | null): TemperatureBand {
  if (warmthLevel === null) return "mild";
  if (warmthLevel <= 1) return "hot";
  if (warmthLevel === 2) return "warm";
  if (warmthLevel === 3) return "mild";
  if (warmthLevel === 4) return "cool";
  return "cold";
}

/**
 * Single call site composing style-knowledge functions + deterministic
 * compile-time scores into the compact per-candidate JSON the curator agent
 * sees. No dedup logic lives here -- candidates are already deduplicated and
 * diversified by selectBalancedOutfitPlans() before ever reaching this
 * function.
 */
export function buildCuratorContext(
  candidateDbId: string,
  candidate: GeneratedOutfitCandidate,
  resolvedItems: readonly WardrobeItem[],
  createdItemIds: ReadonlySet<string>,
): CuratorCandidateInput {
  const itemsById = new Map(resolvedItems.map((item) => [item.id, item]));
  const orderedItems = candidate.items
    .map((entry) => ({ entry, item: itemsById.get(entry.itemId) }))
    .filter(
      (pair): pair is { entry: (typeof candidate.items)[number]; item: WardrobeItem } =>
        pair.item !== undefined,
    );

  const allColorNames = orderedItems.flatMap(({ item }) => item.color_names);
  const allMaterials = orderedItems.flatMap(({ item }) => flattenMaterials(item.materials));
  const patterns = orderedItems.map(({ item }) => item.pattern);
  const formalityLevels = orderedItems
    .map(({ item }) => item.formality_level)
    .filter((value): value is number => value !== null);

  const topItem = orderedItems.find(({ entry }) => entry.role === "top")?.item;
  const bottomItem = orderedItems.find(({ entry }) => entry.role === "bottom")?.item;
  const silhouetteBalanced =
    topItem && bottomItem
      ? evaluateSilhouetteBalance(
          classifySilhouetteWeight(topItem.fit, topItem.silhouette),
          classifySilhouetteWeight(bottomItem.fit, bottomItem.silhouette),
        ).balanced
      : true;

  const band = warmthToBand(candidate.warmthLevel);
  const hasRainTag = candidate.weatherTags.includes("rain_safe");

  return {
    candidateId: candidateDbId,
    occasionCategory: candidate.occasionCategory,
    formalityLevel: candidate.formalityLevel,
    warmthLevel: candidate.warmthLevel,
    totalScore: candidate.totalScore,
    colorHarmony: candidate.colorHarmony,
    layeringQuality: candidate.layeringQuality,
    occasionFormality: candidate.occasionFormality,
    preferenceMatch: candidate.preferenceMatch,
    variety: candidate.variety,
    containsNewItem: candidate.items.some((item) => createdItemIds.has(item.itemId)),
    items: orderedItems.map(({ entry, item }) => ({
      itemId: item.id,
      role: entry.role,
      category: item.category,
      subcategory: item.subcategory,
      colorNames: item.color_names,
      pattern: item.pattern,
      fit: item.fit,
      silhouette: item.silhouette,
      materials: flattenMaterials(item.materials),
      isNewItem: createdItemIds.has(item.id),
    })),
    styleKnowledge: {
      colorScheme: classifyOutfitColorScheme(allColorNames).scheme,
      patternMixCompatible: evaluatePatternMix(patterns).compatible,
      silhouetteBalanced,
      materialTier: classifyMaterialFormality(allMaterials),
      formalityConsistent: evaluateFormalityConsistency(formalityLevels).consistent,
      matchedArchetypes: matchStyleArchetypes(
        orderedItems.map(({ item }) => ({
          colorNames: item.color_names,
          pattern: item.pattern,
          silhouette: item.silhouette,
          category: item.category,
        })),
      ),
      weatherGuidance: weatherDressingGuidance(band, hasRainTag),
    },
  };
}
