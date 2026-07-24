import { NEUTRALS } from "./constants.data";
import { textOf } from "./text-of";
import type { ArchetypeInputItem } from "./types";

function neutralRatio(items: readonly ArchetypeInputItem[]) {
  return (
    items.filter((item) => item.colorNames.every((color) => NEUTRALS.has(color.toLowerCase())))
      .length / Math.max(1, items.length)
  );
}

export function scoreMinimalist(items: readonly ArchetypeInputItem[]) {
  const noPattern = items.every((item) => !item.pattern || item.pattern.toLowerCase() === "solid");
  return neutralRatio(items) * 0.6 + (noPattern ? 0.4 : 0);
}

export function scoreClassic(items: readonly ArchetypeInputItem[]) {
  const tailored = items.filter((item) => /tailor|structured|straight/.test(textOf(item))).length;
  return (tailored / Math.max(1, items.length)) * 0.5 + neutralRatio(items) * 0.5;
}
