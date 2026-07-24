import type { OccasionCategory } from "@/lib/recommendation";

export interface OccasionStyleProfile {
  category: OccasionCategory;
  narrative: string;
  formalityRange: readonly [number, number];
  colorGuidance: string;
  avoid: readonly string[];
}
