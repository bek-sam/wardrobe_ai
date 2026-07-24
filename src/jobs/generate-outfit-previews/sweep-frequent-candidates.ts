import type { AdminClient, ServerEnvironment } from "./types";

export async function sweepFrequentCandidates(admin: AdminClient, environment: ServerEnvironment) {
  const { data: frequentRows } = await admin
    .from("outfit_candidates")
    .select("id, user_id")
    .eq("status", "active")
    .eq("preview_status", "none")
    .gte("times_suggested", environment.PREVIEW_FREQUENTLY_SUGGESTED_THRESHOLD)
    .limit(50);
  for (const row of frequentRows ?? []) {
    try {
      await admin.rpc("enqueue_outfit_preview_job", {
        p_user_id: row.user_id,
        p_candidate_id: row.id,
        p_priority_reason: "frequently_suggested",
        p_max_queued_per_user: environment.PREVIEW_MAX_QUEUED_PER_USER,
      });
    } catch {
      // Best-effort; one bad row must never block the rest of the sweep.
    }
  }
}
