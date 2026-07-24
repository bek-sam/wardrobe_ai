import type { OutfitPlanProposal } from "@/features/outfits/types";

import type { CompilationBucket, GeneratedOutfitCandidate } from "./types";

/**
 * An earlier bucket may have already produced this exact combination -- in
 * that case keep its metadata/score, but record that this bucket fits it
 * too, rather than silently losing the occasion (dedup was previously pure
 * combinationKey equality, so only the first bucket's fit was ever
 * retrievable).
 */
export function mergeOrAddCandidate(
  proposals: OutfitPlanProposal[],
  metadataByProposalId: Map<string, GeneratedOutfitCandidate>,
  built: { proposal: OutfitPlanProposal; metadata: GeneratedOutfitCandidate } | null,
  bucket: CompilationBucket,
) {
  if (!built) return;
  const existing = metadataByProposalId.get(built.proposal.id);
  if (existing) {
    if (!existing.occasionCategories.includes(bucket.key)) {
      existing.occasionCategories.push(bucket.key);
    }
    return;
  }
  proposals.push(built.proposal);
  metadataByProposalId.set(built.proposal.id, built.metadata);
}
