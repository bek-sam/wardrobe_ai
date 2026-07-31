import { z } from "zod";

export const VARIANT_MODES = ["safe", "fresh", "statement"] as const;

export const outfitVariantExplanationSchema = z
  .object({
    variantId: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(80),
    /**
     * At most three: one context/practical reason, one visual/style reason,
     * and one personal/rotation reason where it genuinely applies. More than
     * that stops being useful and starts being fashion jargon.
     */
    reasons: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
    /** Only actionable warnings; an unactionable caveat is noise. */
    warnings: z.array(z.string().trim().min(1).max(180)).max(3),
    /** One short line naming what makes this variant different from the others. */
    stylistNote: z.string().trim().min(1).max(200),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const outfitVariantsResultSchema = z
  .object({
    variants: z.array(outfitVariantExplanationSchema).min(1).max(3),
    /** One plain sentence about the conditions these looks were built for. */
    contextSummary: z.string().trim().min(1).max(240),
  })
  .strict();

export type OutfitVariantMode = (typeof VARIANT_MODES)[number];
export type OutfitVariantExplanation = z.output<typeof outfitVariantExplanationSchema>;
export type OutfitVariantsResult = z.output<typeof outfitVariantsResultSchema>;
