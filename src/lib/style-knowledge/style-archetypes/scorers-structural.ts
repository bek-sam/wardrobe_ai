import { textOf } from "./text-of";
import type { ArchetypeInputItem } from "./types";

export function scoreEdgy(items: readonly ArchetypeInputItem[]) {
  const dark = items.filter((item) =>
    item.colorNames.some((color) => ["black", "charcoal"].includes(color.toLowerCase())),
  ).length;
  const hardware = items.filter((item) =>
    /leather|studded|zip|hardware|asymmetric/.test(textOf(item)),
  ).length;
  return (dark / Math.max(1, items.length)) * 0.5 + (hardware / Math.max(1, items.length)) * 0.5;
}

export function scoreStreetwear(items: readonly ArchetypeInputItem[]) {
  const oversized = items.filter((item) => /oversized|baggy|graphic/.test(textOf(item))).length;
  const sneakers = items.filter((item) => /sneaker/.test(textOf(item))).length;
  return (
    (oversized / Math.max(1, items.length)) * 0.6 + (sneakers / Math.max(1, items.length)) * 0.4
  );
}

export function scoreArtsy(items: readonly ArchetypeInputItem[]) {
  const uniquePatterns = new Set(items.map((item) => item.pattern).filter(Boolean)).size;
  return Math.min(1, uniquePatterns / Math.max(1, items.length));
}
