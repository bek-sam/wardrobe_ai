import { flattenMaterials } from "./flatten-materials";
import type { OrderedItem } from "./order-items";

export interface ItemArrays {
  allColorNames: string[];
  allMaterials: string[];
  patterns: (string | null)[];
  formalityLevels: number[];
}

export function deriveItemArrays(orderedItems: readonly OrderedItem[]): ItemArrays {
  return {
    allColorNames: orderedItems.flatMap(({ item }) => item.color_names),
    allMaterials: orderedItems.flatMap(({ item }) => flattenMaterials(item.materials)),
    patterns: orderedItems.map(({ item }) => item.pattern),
    formalityLevels: orderedItems
      .map(({ item }) => item.formality_level)
      .filter((value): value is number => value !== null),
  };
}
