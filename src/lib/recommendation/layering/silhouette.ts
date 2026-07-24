import type { WardrobeItem } from "@/features/wardrobe/types";

export type SilhouetteGroup = "fitted" | "straight" | "full" | "unknown";

export function silhouetteGroup(value: string | null): SilhouetteGroup {
  const normalized = value?.toLowerCase() ?? "";
  if (/fitted|slim|tailored|clean|taper/.test(normalized)) return "fitted";
  if (/wide|full|oversize|relaxed|volume|flare|baggy/.test(normalized)) return "full";
  if (/straight|regular|classic/.test(normalized)) return "straight";
  return "unknown";
}

export function isStatementPiece(item: WardrobeItem) {
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
