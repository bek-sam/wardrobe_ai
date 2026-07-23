import type { planAsset } from "./plan-asset";
import type { AssetMetadata, PromotableAssetKind } from "./schemas";
import type {
  ConfirmedImportCandidateAssets,
  ImportAssetPromotionBuckets,
  ImportAssetPromotionPlan,
} from "./types";

type Entry = {
  kind: PromotableAssetKind;
  asset: { path: string; metadata: AssetMetadata } | null;
  sourceBucket: string;
  destinationBucket: string;
};

export function planCandidateAssets(
  userId: string,
  candidate: ConfirmedImportCandidateAssets,
  buckets: ImportAssetPromotionBuckets,
  plan: typeof planAsset,
): ImportAssetPromotionPlan[] {
  const { candidateId, itemId } = candidate;
  const entries: Entry[] = [
    {
      kind: "crop",
      asset: candidate.crop,
      sourceBucket: buckets.originals,
      destinationBucket: buckets.items,
    },
    {
      kind: "cutout",
      asset: candidate.cutout,
      sourceBucket: buckets.generated,
      destinationBucket: buckets.generated,
    },
    {
      kind: "modeled",
      asset: candidate.modeled,
      sourceBucket: buckets.generated,
      destinationBucket: buckets.generated,
    },
  ];

  return entries
    .filter(
      (entry): entry is Entry & { asset: NonNullable<Entry["asset"]> } => entry.asset !== null,
    )
    .map(({ kind, asset, sourceBucket, destinationBucket }) =>
      plan({ userId, candidateId, itemId, kind, sourceBucket, destinationBucket, asset }),
    );
}
