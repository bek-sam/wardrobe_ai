import { CONFIDENCE_FLOOR, STYLE_ARCHETYPES } from "./constants.data";
import type { StyleArchetype } from "./constants.data";
import { ARCHETYPE_SCORERS } from "./scorers";
import type { ArchetypeInputItem } from "./types";

export function matchStyleArchetypes(
  items: readonly ArchetypeInputItem[],
): { archetype: StyleArchetype; confidence: number }[] {
  if (items.length === 0) return [];
  return STYLE_ARCHETYPES.map((archetype) => ({
    archetype,
    confidence: Math.min(1, ARCHETYPE_SCORERS[archetype](items)),
  }))
    .filter((entry) => entry.confidence >= CONFIDENCE_FLOOR)
    .sort((first, second) => second.confidence - first.confidence);
}
