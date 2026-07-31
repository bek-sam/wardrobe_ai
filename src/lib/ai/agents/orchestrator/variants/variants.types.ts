import type { OutfitItemRole } from "@/features/outfits/types";
import type { OutfitVariantMode } from "@/lib/ai/schemas/outfit-variants";

import type { OrchestratorWeather } from "../answers.types";

export type VariantItemView = {
  itemId: string;
  role: OutfitItemRole;
  sortOrder: number;
  name: string;
  category: string;
  colorNames: string[];
  primaryColorHex: string | null;
  pattern: string | null;
  availabilityStatus: string;
  favorite: boolean;
  wearCount: number;
};

export type OutfitVariantView = {
  mode: OutfitVariantMode;
  candidateId: string;
  title: string;
  items: VariantItemView[];
  reasons: string[];
  warnings: string[];
  stylistNote: string;
  /** Model confidence, kept internal-ish: never rendered as a certainty score. */
  confidence: number;
  styleTags: string[];
  /** False when a piece has no cut-out photo, so try-on cannot render it. */
  canVisualize: boolean;
};

export type OutfitVariantsAnswer = {
  kind: "variants";
  generationId: string | null;
  variants: OutfitVariantView[];
  contextSummary: string;
  weather: OrchestratorWeather;
  /** Present when fewer than three meaningfully different looks exist yet. */
  shortfallReason: string | null;
};
