import type { WardrobeItem } from "@/features/wardrobe/types";
import { selectBalancedOutfitPlans } from "@/lib/recommendation";

import { buildFoundations } from "./build-foundations";
import {
  MAX_FOUNDATIONS_PER_BUCKET_DEFAULT,
  MAX_VARIANTS_PER_FOUNDATION_BUCKET,
} from "./constants.data";
import { DEFAULT_COMPILATION_BUCKETS } from "./default-buckets";
import { groupByRole } from "./group-by-role";
import { populateCandidateProposals } from "./populate-candidates";
import type { GenerateOutfitCandidatesOptions, GeneratedOutfitCandidate } from "./types";

/**
 * Greedily fills each outfit role using the same pairwise scoring the
 * shortlist/stylist path already applies, expands a small bounded set of
 * layer/footwear/accessory variants per foundation — both band-agnostic and,
 * for the top-ranked foundations, weather-biased (cold/mild/warm/hot/rain) so
 * the library holds genuinely different item picks per condition, not one
 * candidate re-tagged five ways — then runs every candidate through the
 * existing selectBalancedOutfitPlans for dedup and diversity. Intended to run
 * inside the wardrobe compilation job, not on the request path.
 */
export function generateOutfitCandidates(
  items: readonly WardrobeItem[],
  options: GenerateOutfitCandidatesOptions = {},
): GeneratedOutfitCandidate[] {
  const buckets = options.buckets ?? DEFAULT_COMPILATION_BUCKETS;
  const maxFoundations = options.maxFoundations ?? 2000;
  const maxFoundationsPerBucket =
    options.maxFoundationsPerBucket ?? MAX_FOUNDATIONS_PER_BUCKET_DEFAULT;
  const maxCandidates = options.maxCandidates ?? Math.min(1000, Math.max(20, items.length * 8));

  const groups = groupByRole(items);
  const foundations = buildFoundations(groups, maxFoundations);
  if (foundations.length === 0) return [];

  const { proposals, metadataByProposalId } = populateCandidateProposals(
    foundations,
    groups,
    buckets,
    maxFoundationsPerBucket,
    options.preferences,
  );

  const { selected } = selectBalancedOutfitPlans(proposals, items, {
    count: maxCandidates,
    maximumFoundationRepeats: Math.max(1, buckets.length) * MAX_VARIANTS_PER_FOUNDATION_BUCKET,
  });

  return selected
    .map((proposal) => metadataByProposalId.get(proposal.id))
    .filter((candidate): candidate is GeneratedOutfitCandidate => candidate !== undefined);
}
