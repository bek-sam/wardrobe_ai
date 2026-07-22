import { z } from "zod";

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
