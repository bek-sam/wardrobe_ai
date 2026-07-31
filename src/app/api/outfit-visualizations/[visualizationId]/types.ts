import type { OutfitItemRole } from "@/features/outfits/types";
import type { GarmentHotspot, VisualizationStatus } from "@/lib/visualization";

export type SnapshotRow = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
  hotspot: GarmentHotspot | null;
};

export type VisualizationRecord = {
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
