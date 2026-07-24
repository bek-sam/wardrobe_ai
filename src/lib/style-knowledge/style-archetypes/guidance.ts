import { ARCHETYPE_GUIDANCE } from "./constants.data";
import type { StyleArchetype } from "./constants.data";

export function archetypeGuidance(archetype: StyleArchetype): string {
  return ARCHETYPE_GUIDANCE[archetype];
}
