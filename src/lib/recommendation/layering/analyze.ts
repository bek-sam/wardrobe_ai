import type { WardrobeItem } from "@/features/wardrobe/types";

import { groupItemsByRole } from "./group-by-role";
import { scoreLayerOverTop } from "./layer-compatibility";
import { clamp01 } from "./normalize";
import { isStatementPiece, scoreSilhouetteCompatibility } from "./silhouette";

export interface LayeringAnalysis {
  score: number;
  issues: string[];
}

export function analyzeLayering(items: readonly WardrobeItem[]): LayeringAnalysis {
  const { byRole, issues } = groupItemsByRole(items);
  let score = 0.72;

  for (const [role, roleItems] of byRole) {
    if (roleItems.length > 1) {
      issues.push(`Multiple ${role} items make the outfit structure ambiguous.`);
      score -= 0.35;
    }
  }

  const top = byRole.get("top")?.[0];
  const bottom = byRole.get("bottom")?.[0];
  const layer = byRole.get("layer")?.[0];

  if (top && bottom) {
    const silhouetteScore = scoreSilhouetteCompatibility(top, bottom);
    score = score * 0.45 + silhouetteScore * 0.55;
    if (silhouetteScore < 0.5) issues.push("The top and bottom both carry substantial volume.");
  }

  if (layer && !top) {
    issues.push("An outer layer requires a top underneath it.");
    score -= 0.4;
  } else if (layer && top) {
    const layerCompatibility = scoreLayerOverTop(layer, top);
    score += layerCompatibility.scoreDelta;
    issues.push(...layerCompatibility.issues);
  }

  const statementCount = items.filter(isStatementPiece).length;
  if (statementCount > 1) {
    issues.push("More than one patterned piece competes for attention.");
    score -= Math.min(0.2, (statementCount - 1) * 0.1);
  }

  return { score: clamp01(score), issues };
}
