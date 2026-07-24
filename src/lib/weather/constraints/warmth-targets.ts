import type { TemperatureBand } from "../types";

export function warmthTargets(band: TemperatureBand) {
  switch (band) {
    case "extreme_cold":
      return { targetWarmthLevel: 5, minimumOutfitWarmth: 4, maximumItemWarmth: 5 };
    case "cold":
      return { targetWarmthLevel: 4, minimumOutfitWarmth: 3, maximumItemWarmth: 5 };
    case "cool":
      return { targetWarmthLevel: 3, minimumOutfitWarmth: 2, maximumItemWarmth: 5 };
    case "mild":
      return { targetWarmthLevel: 2, minimumOutfitWarmth: 1, maximumItemWarmth: 4 };
    case "warm":
      return { targetWarmthLevel: 2, minimumOutfitWarmth: 1, maximumItemWarmth: 3 };
    case "hot":
      return { targetWarmthLevel: 1, minimumOutfitWarmth: 1, maximumItemWarmth: 2 };
    case "extreme_hot":
      return { targetWarmthLevel: 1, minimumOutfitWarmth: 1, maximumItemWarmth: 1 };
  }
}
