import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import type { CandidateScoringContext } from "@/lib/recommendation";

import { buildOptionalRoleVariants } from "./build-optional-variants";
import { WEATHER_VARIANT_FOUNDATION_LIMIT } from "./constants.data";
import { WEATHER_VARIANT_CONTEXTS } from "./synthetic-weather";

export function addWeatherBiasedVariants(
  rankedFoundations: readonly WardrobeItem[][],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  context: CandidateScoringContext,
  addVariant: (
    variant: ReturnType<typeof buildOptionalRoleVariants>[number],
    foundation: readonly WardrobeItem[],
    variantContext: CandidateScoringContext,
  ) => void,
) {
  for (const foundation of rankedFoundations.slice(0, WEATHER_VARIANT_FOUNDATION_LIMIT)) {
    for (const { weather } of WEATHER_VARIANT_CONTEXTS) {
      const weatherContext: CandidateScoringContext = { ...context, weather };
      for (const variant of buildOptionalRoleVariants(foundation, groups, weatherContext)) {
        addVariant(variant, foundation, weatherContext);
      }
    }
  }
}
