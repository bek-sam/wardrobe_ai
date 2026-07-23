import { assertOwnedStoragePath } from "@/lib/storage/private-images";

import { buildPromotedImportAssetPath } from "./build-path";
import type { AssetMetadata, PromotableAssetKind } from "./schemas";
import type { ImportAssetPromotionPlan } from "./types";

export function planAsset(input: {
  userId: string;
  candidateId: string;
  itemId: string;
  kind: PromotableAssetKind;
  sourceBucket: string;
  destinationBucket: string;
  asset: { path: string; metadata: AssetMetadata };
}): ImportAssetPromotionPlan {
  assertOwnedStoragePath(input.asset.path, input.userId);
  return {
    candidateId: input.candidateId,
    itemId: input.itemId,
    kind: input.kind,
    contentType: input.asset.metadata.mime_type,
    source: { bucket: input.sourceBucket, path: input.asset.path },
    destination: {
      bucket: input.destinationBucket,
      path: buildPromotedImportAssetPath({
        userId: input.userId,
        itemId: input.itemId,
        candidateId: input.candidateId,
        kind: input.kind,
        contentType: input.asset.metadata.mime_type,
      }),
    },
  };
}
