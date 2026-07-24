import type { SupabaseClient } from "@supabase/supabase-js";

export async function handleGetCompilationStatus(supabase: SupabaseClient, userId: string) {
  const [{ data: state, error: stateError }, { data: latestJob, error: jobError }] =
    await Promise.all([
      supabase
        .from("wardrobe_compilation_state")
        .select("dirty_since, last_compiled_at, candidate_count, compiled_wardrobe_version")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("wardrobe_compilation_jobs")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (stateError) throw stateError;
  if (jobError) throw jobError;

  return {
    dirty_since: state?.dirty_since ?? null,
    last_compiled_at: state?.last_compiled_at ?? null,
    candidate_count: state?.candidate_count ?? 0,
    compiled_wardrobe_version: state?.compiled_wardrobe_version ?? null,
    latest_job_status: latestJob?.status ?? null,
  };
}
