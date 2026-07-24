import type { SupabaseClient } from "@supabase/supabase-js";

import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";

// A new job was just queued: try to process it immediately for low latency.
// If it's claimed by a concurrent worker first, that's fine -- it stays
// queued and a worker will still pick it up.
export async function claimAndRunJob(supabase: SupabaseClient, userId: string) {
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_next_own_wardrobe_compilation_job",
    { p_lease_seconds: 300 },
  );
  if (claimError) throw claimError;
  const claimedJob = Array.isArray(claimed) ? claimed[0] : claimed;
  const jobId =
    claimedJob && typeof claimedJob === "object" && "id" in claimedJob ? claimedJob.id : null;
  if (typeof jobId !== "string") return null;

  return compileWardrobeForUser(userId, jobId);
}
