import type { WardrobeItem } from "@/features/wardrobe/types";

import { isStatementPiece, silhouetteGroup } from "./silhouette";

export function scoreLayerOverTop(
  layer: WardrobeItem,
  top: WardrobeItem,
): { scoreDelta: number; issues: string[] } {
  const issues: string[] = [];
  let scoreDelta = 0;
  const layerGroup = silhouetteGroup(layer.silhouette ?? layer.fit);
  const topGroup = silhouetteGroup(top.silhouette ?? top.fit);

  if (layerGroup === "fitted" && topGroup === "full") {
    issues.push("A fitted outer layer may not sit naturally over a full top.");
    scoreDelta -= 0.25;
  }
  if ((layer.warmth_level ?? 0) >= 4 && isStatementPiece(top) && isStatementPiece(layer)) {
    issues.push("A heavy statement layer competes with a patterned base.");
    scoreDelta -= 0.15;
  } else if ((layer.warmth_level ?? 0) >= 4 && !isStatementPiece(top)) {
    scoreDelta += 0.08;
  }

  return { scoreDelta, issues };
}
