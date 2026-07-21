import { z } from "zod";

export const researchStatusSchema = z.enum(["verified", "likely", "uncertain", "not_found"]);

export const researchResultSchema = z
  .object({
    status: researchStatusSchema,
    confidence: z.number().min(0).max(1),
    summary: z.string().max(1_200),
    matchedClues: z.array(z.string().min(1).max(180)).max(16),
    contradictions: z.array(z.string().min(1).max(180)).max(16),
    proposedChanges: z
      .object({
        brand: z.string().max(120).nullable(),
        productName: z.string().max(160).nullable(),
        modelNumber: z.string().max(100).nullable(),
        materials: z.array(z.string().min(1).max(100)).max(12),
        careInstructions: z.array(z.string().min(1).max(180)).max(16),
        typicalPrice: z.number().nonnegative().nullable(),
        currency: z.string().length(3).nullable(),
        releaseLine: z.string().max(160).nullable(),
      })
      .strict(),
    evidence: z
      .array(
        z
          .object({
            claim: z.string().min(1).max(260),
            supportsFields: z.array(z.string().min(1).max(80)).max(12),
            sourceUrl: z
              .url()
              .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();

export type ResearchResult = z.infer<typeof researchResultSchema>;
