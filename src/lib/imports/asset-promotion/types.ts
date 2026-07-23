import type { AssetMetadata, ImageMimeType, PromotableAssetKind } from "./schemas";

export type ImportAssetPromotionPlan = {
  candidateId: string;
  itemId: string;
  kind: PromotableAssetKind;
  contentType: ImageMimeType;
  source: {
    bucket: string;
    path: string;
  };
  destination: {
    bucket: string;
    path: string;
  };
};

export type ConfirmedImportCandidateAssets = {
  candidateId: string;
  itemId: string;
  crop: { path: string; metadata: AssetMetadata } | null;
  cutout: { path: string; metadata: AssetMetadata };
  modeled: { path: string; metadata: AssetMetadata } | null;
};

export type ImportAssetPromotionBuckets = {
  originals: string;
  items: string;
  generated: string;
};
