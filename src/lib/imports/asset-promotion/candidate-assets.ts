import type { ConfirmedCandidate } from "./schemas";
import type { ConfirmedImportCandidateAssets } from "./types";

export function candidateAssets(candidate: ConfirmedCandidate): ConfirmedImportCandidateAssets {
  if (candidate.crop_storage_path && !candidate.crop_asset_metadata) {
    throw new Error("A confirmed crop is missing asset metadata.");
  }
  if (candidate.modeled_storage_path && !candidate.modeled_asset_metadata) {
    throw new Error("A confirmed modeled image is missing asset metadata.");
  }

  return {
    candidateId: candidate.id,
    itemId: candidate.wardrobe_item_id,
    crop:
      candidate.crop_storage_path && candidate.crop_asset_metadata
        ? { path: candidate.crop_storage_path, metadata: candidate.crop_asset_metadata }
        : null,
    cutout: {
      path: candidate.cutout_storage_path,
      metadata: candidate.cutout_asset_metadata,
    },
    modeled:
      candidate.modeled_storage_path && candidate.modeled_asset_metadata
        ? { path: candidate.modeled_storage_path, metadata: candidate.modeled_asset_metadata }
        : null,
  };
}
