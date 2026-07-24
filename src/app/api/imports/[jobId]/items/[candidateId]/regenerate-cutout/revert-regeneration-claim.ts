import type { SupabaseClient } from "@supabase/supabase-js";

// Unwinds the atomic claim in handler.ts when quota enforcement fails after
// it, landing the candidate in a valid, retryable state instead of stranding
// it in "extracting" with no generation ever happening.
export async function revertRegenerationClaim(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  await admin
    .from("import_job_candidates")
    .update({
      status: "failed",
      error_code: "quota_exceeded",
      error_message: "Daily image generation limit reached.",
    })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "extracting");
}
