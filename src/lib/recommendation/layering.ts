import type { WardrobeItem } from "@/features/wardrobe/types";

import { resolveWardrobeItemRole } from "./item-role";

export interface LayeringAnalysis {
  score: number;
  issues: string[];
}

type SilhouetteGroup = "fitted" | "straight" | "full" | "unknown";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function silhouetteGroup(value: string | null): SilhouetteGroup {
  const normalized = value?.toLowerCase() ?? "";
  if (/fitted|slim|tailored|clean|taper/.test(normalized)) return "fitted";
  if (/wide|full|oversize|relaxed|volume|flare|baggy/.test(normalized)) return "full";
  if (/straight|regular|classic/.test(normalized)) return "straight";
  return "unknown";
}

function isStatementPiece(item: WardrobeItem) {
  const pattern = item.pattern?.toLowerCase() ?? "";
  return pattern.length > 0 && !["solid", "plain", "none"].includes(pattern);
}

export function scoreSilhouetteCompatibility(
  top: Pick<WardrobeItem, "silhouette" | "fit">,
  bottom: Pick<WardrobeItem, "silhouette" | "fit">,
): number {
  const topGroup = silhouetteGroup(top.silhouette ?? top.fit);
  const bottomGroup = silhouetteGroup(bottom.silhouette ?? bottom.fit);

  if (topGroup === "full" && bottomGroup === "full") return 0.35;
  if (
    (topGroup === "full" && bottomGroup === "fitted") ||
    (topGroup === "fitted" && bottomGroup === "full")
  ) {
    return 0.95;
  }
  if (topGroup === "unknown" || bottomGroup === "unknown") return 0.68;
  if (topGroup === "straight" && bottomGroup === "straight") return 0.8;
  return 0.82;
}

export function analyzeLayering(items: readonly WardrobeItem[]): LayeringAnalysis {
  const issues: string[] = [];
  const byRole = new Map<string, WardrobeItem[]>();

  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (!role) {
      issues.push(`Could not determine the outfit role for ${item.id}.`);
      continue;
    }
    const group = byRole.get(role) ?? [];
    group.push(item);
    byRole.set(role, group);
  }

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
  }

  if (layer && top) {
    const layerGroup = silhouetteGroup(layer.silhouette ?? layer.fit);
    const topGroup = silhouetteGroup(top.silhouette ?? top.fit);
    if (layerGroup === "fitted" && topGroup === "full") {
      issues.push("A fitted outer layer may not sit naturally over a full top.");
      score -= 0.25;
    }
    if ((layer.warmth_level ?? 0) >= 4 && isStatementPiece(top) && isStatementPiece(layer)) {
      issues.push("A heavy statement layer competes with a patterned base.");
      score -= 0.15;
    } else if ((layer.warmth_level ?? 0) >= 4 && !isStatementPiece(top)) {
      score += 0.08;
    }
  }

  const statementCount = items.filter(isStatementPiece).length;
  if (statementCount > 1) {
    issues.push("More than one patterned piece competes for attention.");
    score -= Math.min(0.2, (statementCount - 1) * 0.1);
  }

  return { score: clamp01(score), issues };
}
