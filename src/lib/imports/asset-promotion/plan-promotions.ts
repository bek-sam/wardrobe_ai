import { planAsset } from "./plan-asset";
import { planCandidateAssets } from "./plan-candidate-assets";
import { requireUuid } from "./require-uuid";
import type {
  ConfirmedImportCandidateAssets,
  ImportAssetPromotionBuckets,
  ImportAssetPromotionPlan,
} from "./types";

export function planConfirmedImportAssetPromotions(input: {
  userId: string;
  candidates: ConfirmedImportCandidateAssets[];
  buckets: ImportAssetPromotionBuckets;
}): ImportAssetPromotionPlan[] {
  requireUuid(input.userId, "User ID");
  const plans: ImportAssetPromotionPlan[] = [];

  for (const candidate of input.candidates) {
    requireUuid(candidate.candidateId, "Candidate ID");
    requireUuid(candidate.itemId, "Item ID");
    plans.push(...planCandidateAssets(input.userId, candidate, input.buckets, planAsset));
  }

  return plans;
}
