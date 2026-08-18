import type { z } from "zod";
import type {
  generatedOutfitSchema,
  outfitItemSelectionSchema,
  outfitPlanProposalSchema,
} from "./schemas";
import { OUTFIT_ITEM_ROLES } from "./schemas";

export { OUTFIT_ITEM_ROLES };

export type OutfitItemRole = (typeof OUTFIT_ITEM_ROLES)[number];

export type OutfitItemSelection = z.output<typeof outfitItemSelectionSchema>;

export type GeneratedOutfit = z.output<typeof generatedOutfitSchema>;

export type OutfitPlanProposal = z.output<typeof outfitPlanProposalSchema>;
