import type { OutfitItemRole } from "@/features/outfits/types";
import type { getServerEnvironment } from "@/lib/env/server";
import type { createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;
export type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

export type VisualizationJobRow = {
  id: string;
  visualization_id: string;
  user_id: string;
  attempt_count: number;
  max_attempts: number;
};

export type VisualizationRow = {
  id: string;
  user_id: string;
  status: string;
  identity_reference_id: string;
  corrective_attempt_count: number;
};

export type SnapshotItemRow = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
  cutout_bucket_id: string;
  cutout_storage_path: string;
};

export type VisualizationJobOutcome = "completed" | "failed" | "superseded";
