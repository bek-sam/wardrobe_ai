import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stop claiming further work once we're this close to the platform's
// maxDuration, so an in-flight job's lease (300s, matching claim below)
// expires cleanly and a future invocation reclaims it, instead of the whole
// function being killed mid-write.
const EXECUTION_BUDGET_MS = 260_000;

export async function claimAndProcessJobs() {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_wardrobe_compilation_jobs", {
    p_limit: 5,
    p_lease_seconds: 300,
  });
  if (error) return null;

  const jobs = (Array.isArray(data) ? data : data ? [data] : []) as {
    id: string;
    user_id: string;
  }[];
  if (jobs.length === 0) return { claimed: 0, completed: 0, failed: 0, skipped: 0 };

  let completed = 0;
  let failed = 0;
  let skipped = 0;
  for (const job of jobs) {
    if (Date.now() - startedAt > EXECUTION_BUDGET_MS) {
      // Leave the remaining claimed jobs' leases to expire naturally --
      // claim_wardrobe_compilation_jobs() only claims locked_until <= now(),
      // so the next invocation (or a concurrent worker) picks them back up.
      skipped = jobs.length - completed - failed;
      break;
    }
    try {
      await compileWardrobeForUser(job.user_id, job.id);
      completed += 1;
    } catch {
      failed += 1;
    }
  }

  return { claimed: jobs.length, completed, failed, skipped };
}
