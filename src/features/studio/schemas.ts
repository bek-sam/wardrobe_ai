import { z } from "zod";

import { generateOutfitRequestSchema } from "@/features/stylist/schemas";

/**
 * The studio's request adds locked item IDs. They are a *hard* constraint
 * enforced deterministically server-side: a candidate that does not contain
 * every locked ID is filtered out before the model is ever asked to explain
 * anything, so remix cannot change a locked piece.
 */
export const outfitVariantsRequestSchema = generateOutfitRequestSchema.omit({ save: true }).extend({
  lockedItemIds: z.array(z.string().uuid()).max(6).default([]),
});

export type OutfitVariantsRequest = z.output<typeof outfitVariantsRequestSchema>;
