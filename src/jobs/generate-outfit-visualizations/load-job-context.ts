import { downloadPrivateObject } from "@/lib/storage/private-images";

import type { AdminClient, SnapshotItemRow, VisualizationJobRow, VisualizationRow } from "./types";

export type JobContext = {
  visualization: VisualizationRow;
  items: SnapshotItemRow[];
  identity: Buffer;
};

/**
 * Loads everything the render needs, re-reading each row scoped to the job's
 * own user rather than trusting anything the claim RPC returned. Returns null
 * when the visualization or its identity reference is gone or no longer
 * active, which the caller treats as superseded rather than failed.
 */
export async function loadJobContext(
  admin: AdminClient,
  job: VisualizationJobRow,
): Promise<JobContext | null> {
  const { data: visualization } = await admin
    .from("outfit_visualizations")
    .select("id, user_id, status, identity_reference_id, corrective_attempt_count")
    .eq("id", job.visualization_id)
    .eq("user_id", job.user_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!visualization || visualization.status === "superseded") return null;

  const { data: reference } = await admin
    .from("profile_identity_references")
    .select("bucket_id, storage_path")
    .eq("id", visualization.identity_reference_id)
    .eq("user_id", job.user_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!reference) return null;

  const { data: items } = await admin
    .from("outfit_visualization_items")
    .select("item_id, role, sort_order, cutout_bucket_id, cutout_storage_path")
    .eq("visualization_id", job.visualization_id)
    .eq("user_id", job.user_id)
    .order("sort_order", { ascending: true });
  if (!items || items.length === 0) return null;

  return {
    visualization: visualization as VisualizationRow,
    items: items as SnapshotItemRow[],
    identity: await downloadPrivateObject(
      admin,
      reference.bucket_id as string,
      reference.storage_path as string,
      job.user_id,
    ),
  };
}
