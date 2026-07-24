import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import {
  type CandidatePreferenceContext,
  type CandidateScoringContext,
} from "@/lib/recommendation";

import { addWeatherBiasedVariants } from "./add-weather-variants";
import { buildGeneratedCandidate } from "./build-candidate";
import { buildOptionalRoleVariants } from "./build-optional-variants";
import { rankFoundations } from "./rank-foundations";
import type { CompilationBucket, GeneratedOutfitCandidate } from "./types";

export function populateCandidateProposals(
  foundations: readonly WardrobeItem[][],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  buckets: readonly CompilationBucket[],
  maxFoundationsPerBucket: number,
  preferences: CandidatePreferenceContext | undefined,
) {
  const proposals: OutfitPlanProposal[] = [];
  const metadataByProposalId = new Map<string, GeneratedOutfitCandidate>();

  for (const bucket of buckets) {
    const context: CandidateScoringContext = {
      occasionTags: bucket.occasionTags,
      targetFormality: bucket.targetFormality,
      preferences,
    };

    function addVariant(
      variant: Parameters<typeof buildGeneratedCandidate>[0],
      foundation: readonly WardrobeItem[],
      variantContext: CandidateScoringContext,
    ) {
      const built = buildGeneratedCandidate(variant, foundation, variantContext, bucket);
      if (!built || metadataByProposalId.has(built.proposal.id)) return;
      proposals.push(built.proposal);
      metadataByProposalId.set(built.proposal.id, built.metadata);
    }

    const rankedFoundations = rankFoundations(foundations, context, maxFoundationsPerBucket);

    for (const foundation of rankedFoundations) {
      for (const variant of buildOptionalRoleVariants(foundation, groups, context)) {
        addVariant(variant, foundation, context);
      }
    }

    addWeatherBiasedVariants(rankedFoundations, groups, context, addVariant);
  }

  return { proposals, metadataByProposalId };
}
