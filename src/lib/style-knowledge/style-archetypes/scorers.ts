import type { StyleArchetype } from "./constants.data";
import { scoreClassic, scoreMinimalist } from "./scorers-neutral";
import {
  scoreAthleisure,
  scoreBohemian,
  scoreGlam,
  scorePreppy,
  scoreRomantic,
} from "./scorers-pattern";
import { scoreArtsy, scoreEdgy, scoreStreetwear } from "./scorers-structural";
import type { ArchetypeInputItem } from "./types";

export const ARCHETYPE_SCORERS: Readonly<
  Record<StyleArchetype, (items: readonly ArchetypeInputItem[]) => number>
> = {
  minimalist: scoreMinimalist,
  classic: scoreClassic,
  romantic: scoreRomantic,
  edgy: scoreEdgy,
  bohemian: scoreBohemian,
  preppy: scorePreppy,
  streetwear: scoreStreetwear,
  athleisure: scoreAthleisure,
  glam: scoreGlam,
  artsy: scoreArtsy,
};
