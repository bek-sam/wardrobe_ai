import { z } from "zod";
import { OCCASION_CATEGORIES } from "@/lib/recommendation";

const confidence = z.number().min(0).max(1);

export const detectedGarmentSchema = z
  .object({
    suggestedName: z.string().min(1).max(160),
    category: z.enum([
      "tops",
      "bottoms",
      "dresses",
      "outerwear",
      "shoes",
      "accessories",
      "bags",
      "activewear",
      "swimwear",
      "underwear",
      "other",
    ]),
    subcategory: z.string().max(80).nullable(),
    boundingBox: z
      .object({
        x: z.number().int().min(0).max(999),
        y: z.number().int().min(0).max(999),
        width: z.number().int().min(1).max(1000),
        height: z.number().int().min(1).max(1000),
      })
      .strict(),
    primaryColorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
    secondaryColorHex: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    colorNames: z.array(z.string().min(1).max(40)).max(8),
    pattern: z.string().max(80).nullable(),
    silhouette: z.string().max(80).nullable(),
    apparentMaterial: z.string().max(120).nullable(),
    materialIsInferred: z.literal(true),
    visibleText: z.array(z.string().min(1).max(120)).max(12),
    visibleLogoDescription: z.string().max(200).nullable(),
    seasonSuggestions: z.array(z.string().min(1).max(40)).max(6),
    occasionSuggestions: z.array(z.string().min(1).max(60)).max(8),
    fieldConfidence: z
      .object({
        category: confidence,
        colors: confidence,
        pattern: confidence,
        silhouette: confidence,
        material: confidence,
        visibleText: confidence,
        boundingBox: confidence,
      })
      .strict(),
  })
  .strict();

export const catalogingResultSchema = z
  .object({
    garments: z.array(detectedGarmentSchema).max(12),
    imageNotes: z.string().max(500),
  })
  .strict();

export type DetectedGarment = z.infer<typeof detectedGarmentSchema>;

export type CatalogingResult = z.infer<typeof catalogingResultSchema>;

export const curatorCandidateDecisionSchema = z
  .object({
    candidateId: z.string().uuid(),
    decision: z.enum(["select", "reject"]),
    aestheticTags: z.array(z.string().trim().min(1).max(40)).min(0).max(5),
    occasionCategory: z.enum(OCCASION_CATEGORIES),
    rankAmongNewItemOutfits: z.number().int().min(1).max(40).nullable(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().trim().min(1).max(400),
    rejectionReason: z.string().trim().min(1).max(240).nullable(),
  })
  .strict()
  .refine(
    (value) => (value.decision === "reject") === (value.rejectionReason !== null),
    "rejectionReason must be set exactly when decision is 'reject'.",
  );

export const outfitCuratorResultSchema = z
  .object({
    decisions: z.array(curatorCandidateDecisionSchema).min(1).max(40),
    summary: z.string().trim().min(1).max(600),
  })
  .strict();

export type CuratorCandidateDecision = z.infer<typeof curatorCandidateDecisionSchema>;

export type OutfitCuratorResult = z.infer<typeof outfitCuratorResultSchema>;

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

export const stylistResultSchema = z
  .object({
    title: z.string().min(1).max(100),
    itemIds: z.array(z.string().uuid()).min(1).max(8),
    explanation: z.string().min(1).max(1_200),
    warnings: z.array(z.string().min(1).max(240)).max(8),
    confidence: z.number().min(0).max(1),
    missingCategory: z.string().max(80).nullable(),
    followUpQuestion: z.string().max(240).nullable(),
  })
  .strict();

export const plannedLookSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().min(1).max(100),
    itemIds: z.array(z.string().uuid()).min(1).max(8),
    explanation: z.string().min(1).max(800),
    warnings: z.array(z.string().min(1).max(200)).max(6),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const plannerResultSchema = z
  .object({
    looks: z.array(plannedLookSchema).min(1).max(14),
    missingCategories: z.array(z.string().min(1).max(80)).max(12),
  })
  .strict();

// Used when an outfit's items were already chosen by retrieval from the
// precomputed candidate library: the model only explains the fixed pick, it
// does not choose items, so there is no itemIds field.
export const explainOutfitCandidateResultSchema = z
  .object({
    title: z.string().min(1).max(100),
    explanation: z.string().min(1).max(1_200),
    warnings: z.array(z.string().min(1).max(240)).max(8),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type StylistResult = z.infer<typeof stylistResultSchema>;

export type PlannerResult = z.infer<typeof plannerResultSchema>;

export type ExplainOutfitCandidateResult = z.infer<typeof explainOutfitCandidateResultSchema>;
