import type { SupabaseClient } from "@supabase/supabase-js";

import { throwNotFound } from "@/app/api/_lib/route";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { hasVisualizationImage } from "@/lib/visualization";

import { buildGarmentDetails } from "./garment-details";
import { presentVisualizationRecord } from "./present-record";
import type { SnapshotRow, VisualizationRecord } from "./types";

const RECORD_FIELDS =
  "id, status, source_kind, source_id, bucket_id, storage_path, qa_status, error_code, error_summary, stale_reason, attempt_count, corrective_attempt_count, created_at, completed_at";

export async function handleGetVisualization(
  supabase: SupabaseClient,
  userId: string,
  visualizationId: string,
) {
  const { data, error } = await supabase
    .from("outfit_visualizations")
    .select(RECORD_FIELDS)
    .eq("id", visualizationId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throwNotFound("Try-on");
  const record = data as unknown as VisualizationRecord;

  const { data: snapshot } = await supabase
    .from("outfit_visualization_items")
    .select("item_id, role, sort_order, hotspot")
    .eq("visualization_id", visualizationId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  const imageUrl =
    hasVisualizationImage(record.status) && record.bucket_id && record.storage_path
      ? await createPrivateSignedUrl(
          supabase,
          record.bucket_id,
          record.storage_path,
          userId,
          getServerEnvironment().SIGNED_URL_TTL_SECONDS,
        ).catch(() => null)
      : null;

  return {
    ...presentVisualizationRecord(record),
    imageUrl,
    garments: await buildGarmentDetails(supabase, userId, (snapshot ?? []) as SnapshotRow[]),
  };
}
