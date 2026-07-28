import { sortedCounts } from "./counters";

export function buildOverrepresented(categories: ReadonlyMap<string, number>, itemCount: number) {
  return sortedCounts(categories)
    .filter((category) => itemCount >= 5 && category.count / itemCount >= 0.4)
    .map((category) => ({
      ...category,
      note: `${category.name} makes up a large share of this wardrobe; review fit and usage before adding more.`,
    }));
}
