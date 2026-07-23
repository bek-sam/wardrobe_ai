import type { WardrobeItem } from "@/features/wardrobe/types";

import { analyzeColorPair } from "./analyze-color-pair";

function primaryItemColor(item: Pick<WardrobeItem, "primary_color_hex" | "color_names">) {
  return item.primary_color_hex ?? item.color_names[0] ?? null;
}

export function scoreColorHarmony(
  items: readonly Pick<WardrobeItem, "primary_color_hex" | "color_names">[],
): number {
  if (items.length < 2) return items.length === 1 ? 0.75 : 0.5;

  const pairScores: number[] = [];
  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const first = items[firstIndex];
      const second = items[secondIndex];
      if (!first || !second) continue;
      pairScores.push(analyzeColorPair(primaryItemColor(first), primaryItemColor(second)).score);
    }
  }

  if (pairScores.length === 0) return 0.5;
  return pairScores.reduce((total, score) => total + score, 0) / pairScores.length;
}
