import type { SupabaseClient } from "@supabase/supabase-js";

import { parseRouteParams, throwNotFound } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { createClient } from "@/lib/supabase/server";
import { hasVisualizationImage } from "@/lib/visualization";
import {
  AI_TRYON_DISCLAIMER,
  isVisualizationInFlight,
  isVisualizationRetryable,
  visualizationProgressLabel,
} from "@/lib/visualization";
import type { OutfitItemRole } from "@/features/outfits";
import type { GarmentHotspot, VisualizationStatus } from "@/lib/visualization";

type SnapshotRow = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
  hotspot: GarmentHotspot | null;
};

type VisualizationRecord = {
  id: string;
  status: VisualizationStatus;
  source_kind: string;
  source_id: string | null;
  bucket_id: string | null;
  storage_path: string | null;
  qa_status: string | null;
  error_code: string | null;
  error_summary: string | null;
  stale_reason: string | null;
  attempt_count: number;
  corrective_attempt_count: number;
  created_at: string;
  completed_at: string | null;
};

/** Only user-confirmed catalog fields; nothing derived from generated pixels. */
const GARMENT_FIELDS =
  "id, name, brand, category, subcategory, primary_color_hex, secondary_color_hex, color_names, pattern, fit, silhouette, materials, size_label, care_instructions, availability_status, status, wear_count, last_worn_at, favorite, metadata_confidence, deleted_at";

async function loadGarmentRows(
  supabase: SupabaseClient,
  userId: string,
  snapshot: readonly SnapshotRow[],
) {
  const itemIds = snapshot.map((entry) => entry.item_id);
  const [{ data: items }, { data: cutouts }] = await Promise.all([
    supabase.from("wardrobe_items").select(GARMENT_FIELDS).eq("user_id", userId).in("id", itemIds),
    supabase
      .from("wardrobe_item_images")
      .select("item_id, bucket_id, storage_path, is_primary")
      .eq("user_id", userId)
      .eq("kind", "cutout")
      .in("item_id", itemIds)
      .order("is_primary", { ascending: false }),
  ]);

  const cutoutByItem = new Map<string, { bucket_id: string; storage_path: string }>();
  for (const row of cutouts ?? []) {
    const itemId = row.item_id as string;
    if (!cutoutByItem.has(itemId)) {
      cutoutByItem.set(itemId, {
        bucket_id: row.bucket_id as string,
        storage_path: row.storage_path as string,
      });
    }
  }

  return {
    itemById: new Map((items ?? []).map((item) => [item.id as string, item])),
    cutoutByItem,
  };
}

/**
 * Every displayed garment fact comes from the owned wardrobe row, never from
 * the generated pixels or the localization model. A deleted or archived item
 * is represented honestly rather than silently dropped, so the UI can say
 * "this piece is no longer in your wardrobe" instead of showing nothing.
 */
async function buildGarmentDetails(
  supabase: SupabaseClient,
  userId: string,
  snapshot: readonly SnapshotRow[],
) {
  const ttl = getServerEnvironment().SIGNED_URL_TTL_SECONDS;
  const { itemById, cutoutByItem } = await loadGarmentRows(supabase, userId, snapshot);

  return Promise.all(
    snapshot.map(async (entry) => {
      const item = itemById.get(entry.item_id) as Record<string, unknown> | undefined;
      const cutout = cutoutByItem.get(entry.item_id);
      return {
        itemId: entry.item_id,
        role: entry.role,
        sortOrder: entry.sort_order,
        hotspot: entry.hotspot,
        available: Boolean(item) && !item?.deleted_at && item?.status === "active",
        item: item ? { ...item, deleted_at: undefined } : null,
        // Signed fresh on every read and never persisted, per the storage
        // contract: only bucket + path are stored.
        cutoutUrl: cutout
          ? await createPrivateSignedUrl(
              supabase,
              cutout.bucket_id,
              cutout.storage_path,
              userId,
              ttl,
            ).catch(() => null)
          : null,
      };
    }),
  );
}

/**
 * The safe, user-facing view of a visualization row. Deliberately omits the
 * bucket, storage path, source hash, provider request body, and model key:
 * the client gets a short-lived signed URL and a status, never a durable
 * pointer at private bytes.
 */
function presentVisualizationRecord(record: VisualizationRecord) {
  return {
    id: record.id,
    status: record.status,
    sourceKind: record.source_kind,
    sourceId: record.source_id,
    progressLabel: visualizationProgressLabel(record.status),
    inFlight: isVisualizationInFlight(record.status),
    canRetry: isVisualizationRetryable(record.status) || record.status === "failed_retryable",
    canChangePhoto: record.error_code === "qa_rejected" || record.status === "blocked",
    staleReason: record.stale_reason,
    errorCode: record.error_code,
    errorSummary: record.error_summary,
    qaStatus: record.qa_status,
    attemptCount: record.attempt_count,
    correctiveAttemptCount: record.corrective_attempt_count,
    disclaimer: AI_TRYON_DISCLAIMER,
    createdAt: record.created_at,
    completedAt: record.completed_at,
  };
}

type Context = { params: Promise<{ visualizationId: string }> };

const RECORD_FIELDS =
  "id, status, source_kind, source_id, bucket_id, storage_path, qa_status, error_code, error_summary, stale_reason, attempt_count, corrective_attempt_count, created_at, completed_at";

async function handleGetVisualization(
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

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { visualizationId } = await parseRouteParams(context.params, visualizationParamsSchema);
    const supabase = await createClient();
    const data = await handleGetVisualization(supabase, viewer.id, visualizationId);
    // Contains a short-lived signed URL: it must never be cached anywhere.
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const { visualizationId } = await parseRouteParams(context.params, visualizationParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("delete_outfit_visualization", {
      p_visualization_id: visualizationId,
    });
    if (error) throw error;
    return ok({ deleted: Boolean(data) });
  } catch (error) {
    return routeError(error);
  }
}
