import { textOf } from "./text-of";
import type { ArchetypeInputItem } from "./types";

const ratio = (items: readonly ArchetypeInputItem[], pattern: RegExp) =>
  items.filter((item) => pattern.test(textOf(item))).length / Math.max(1, items.length);

export const scoreRomantic = (items: readonly ArchetypeInputItem[]) =>
  ratio(items, /floral|flow|soft|ruffle|lace/);
export const scoreBohemian = (items: readonly ArchetypeInputItem[]) =>
  ratio(items, /flow|earthy|paisley|fringe|layer/);
export const scorePreppy = (items: readonly ArchetypeInputItem[]) =>
  ratio(items, /stripe|argyle|collar|polo|blazer/);
export const scoreGlam = (items: readonly ArchetypeInputItem[]) =>
  ratio(items, /satin|sequin|metallic|silk|velvet/);
export const scoreAthleisure = (items: readonly ArchetypeInputItem[]) =>
  ratio(items, /athletic|jogger|legging|sneaker|performance/);
