import { z } from "zod";

import { OCCASION_CATEGORIES } from "@/lib/recommendation/occasion-context";

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
