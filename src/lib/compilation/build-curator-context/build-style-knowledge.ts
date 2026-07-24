import {
  classifyMaterialFormality,
  classifyOutfitColorScheme,
  evaluateFormalityConsistency,
  evaluatePatternMix,
  matchStyleArchetypes,
  weatherDressingGuidance,
} from "@/lib/style-knowledge";
import type { TemperatureBand } from "@/lib/weather";

import type { ItemArrays } from "./derive-item-arrays";
import type { OrderedItem } from "./order-items";

export function buildStyleKnowledge(
  orderedItems: readonly OrderedItem[],
  itemArrays: ItemArrays,
  silhouetteBalanced: boolean,
  band: TemperatureBand,
  hasRainTag: boolean,
) {
  const { allColorNames, allMaterials, patterns, formalityLevels } = itemArrays;
  return {
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
  };
}
