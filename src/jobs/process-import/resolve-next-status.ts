import type { SupabaseClient } from "@supabase/supabase-js";

import { excludeTerminalJobStatuses } from "./job-status";
import type { ImportJobRow } from "./types";

export async function resolveNextJobStatus(admin: SupabaseClient, job: ImportJobRow) {
  const { data: remaining } = await admin
    .from("import_job_candidates")
    .select("status")
    .eq("job_id", job.id)
    .eq("user_id", job.user_id);
  const statuses = (remaining ?? []).map((candidate) => candidate.status as string);
  const nextStatus = statuses.some((status) => status === "extracting")
    ? "extracting"
    : statuses.some((status) => status === "review_crop" || status === "regenerating_crop")
      ? "review_crop"
      : "review_metadata";
  const query = admin
    .from("import_jobs")
    .update({
      status: nextStatus,
      progress: nextStatus === "review_metadata" ? 70 : 50,
      locked_at: null,
      locked_until: null,
      next_attempt_at: null,
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id);
  const { data } = await excludeTerminalJobStatuses(query).select("id").maybeSingle();
  if (data) return nextStatus;

  const { data: current } = await admin
    .from("import_jobs")
    .select("status")
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  return current?.status ?? "cancelled";
}
