import { createAdminClient } from "@/lib/supabase/admin";

import { processClaimedVisualizationJob } from "./process-claimed-job";
import type { VisualizationJobRow } from "./types";

/**
 * Renders a single job already claimed via claim_owned_outfit_visualization_job
 * — the interactive counterpart to processVisualizationBatch, used only when a
 * deployment opts in through VISUALIZATION_INLINE_PROCESSING_ENABLED.
 *
 * Re-selects the row by id scoped to the expected user rather than trusting
 * what the claim RPC returned, mirroring the import and research workers.
 */
export async function processOwnedVisualizationJob(jobId: string, expectedUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("outfit_visualization_jobs")
    .select("id, visualization_id, user_id, attempt_count, max_attempts")
    .eq("id", jobId)
    .eq("user_id", expectedUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Visualization job not found.");

  const outcome = await processClaimedVisualizationJob(admin, data as VisualizationJobRow);
  return { jobId, visualizationId: data.visualization_id as string, outcome };
}
