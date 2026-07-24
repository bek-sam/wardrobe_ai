import { createAdminClient } from "@/lib/supabase/admin";

import { analyzeJob } from "./analyze-job";
import { extractPendingCandidates } from "./extract-pending-candidates";
import { failJob } from "./fail-job";
import { loadJob } from "./load-job";
import { resolveNextJobStatus } from "./resolve-next-status";

export async function processImportJob(jobId: string, expectedUserId?: string) {
  const job = await loadJob(jobId, expectedUserId);
  try {
    if (["queued", "failed", "analyzing"].includes(job.status)) {
      const candidateCount = await analyzeJob(job);
      if (candidateCount === 0) return { jobId: job.id, status: "failed" };
    }

    const admin = createAdminClient();
    await extractPendingCandidates(admin, job);
    const nextStatus = await resolveNextJobStatus(admin, job);
    return { jobId: job.id, status: nextStatus };
  } catch (error) {
    await failJob(job, error);
    throw error;
  }
}
