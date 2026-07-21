import type { z } from "zod";

import type {
  generatedOutfitSchema,
  outfitItemSelectionSchema,
  outfitPlanProposalSchema,
} from "./schemas/outfit";

export const OUTFIT_ITEM_ROLES = ["top", "bottom", "dress", "layer", "shoes", "accessory"] as const;

export type OutfitItemRole = (typeof OUTFIT_ITEM_ROLES)[number];
export type OutfitItemSelection = z.output<typeof outfitItemSelectionSchema>;
export type GeneratedOutfit = z.output<typeof generatedOutfitSchema>;
export type OutfitPlanProposal = z.output<typeof outfitPlanProposalSchema>;
