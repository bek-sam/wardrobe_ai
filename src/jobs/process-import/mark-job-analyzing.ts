import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportJobRow } from "./types";

// Guarded on locked_until matching the snapshot this caller loaded, on top
// of the status check: the claim_import_job(s)/claim_owned_import_job RPCs
// are the real lease authority and already advance locked_until whenever
// they reclaim an expired lease, so a stale in-process caller whose lease
// was stolen out from under it fails this compare-and-swap instead of
// falsely reporting itself as having (re)claimed the job.
export async function markJobAnalyzing(admin: SupabaseClient, job: ImportJobRow) {
  let query = admin
    .from("import_jobs")
    .update({
      status: "analyzing",
      progress: 10,
      attempt_count: job.status === "analyzing" ? job.attempt_count : job.attempt_count + 1,
      processing_started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .in("status", ["queued", "failed", "analyzing"]);
  query =
    job.locked_until === null
      ? query.is("locked_until", null)
      : query.eq("locked_until", job.locked_until);
  const { data } = await query.select("id").maybeSingle();
  return Boolean(data);
}
