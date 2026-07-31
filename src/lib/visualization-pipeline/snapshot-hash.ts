import type { ActiveIdentityReference } from "@/lib/identity-reference";
import type { VisualizationSnapshotItem } from "@/lib/visualization";
import { computeVisualizationSourceHash } from "@/lib/visualization/freshness";

import type { GenerationConfig } from "./generation-config";

/** The snapshot plus every configuration input, reduced to one stable hash. */
export function snapshotSourceHash(
  snapshot: readonly VisualizationSnapshotItem[],
  identity: ActiveIdentityReference,
  config: GenerationConfig,
): string {
  return computeVisualizationSourceHash({
    items: snapshot,
    identitySha256: identity.sha256,
    promptVersion: config.promptVersion,
    capabilityVersion: config.capabilityVersion,
    modelKey: config.modelKey,
    outputSize: config.outputSize,
    outputQuality: config.outputQuality,
    qaVersion: config.qaVersion,
    localizationVersion: config.localizationVersion,
  });
}

/** Snapshot rows in the shape the creating RPC expects. */
export function snapshotRpcItems(snapshot: readonly VisualizationSnapshotItem[]) {
  return snapshot.map((item) => ({
    item_id: item.itemId,
    role: item.role,
    sort_order: item.sortOrder,
    cutout_bucket_id: item.cutoutBucketId,
    cutout_storage_path: item.cutoutStoragePath,
    cutout_sha256: item.cutoutSha256,
  }));
}
