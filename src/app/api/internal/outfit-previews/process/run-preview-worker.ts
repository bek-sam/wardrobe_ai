import {
  enqueueScheduledPreviewJobs,
  processOutfitPreviewBatch,
} from "@/jobs/generate-outfit-previews";
import type { ServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Stop claiming further work once we're this close to the platform's
// maxDuration, mirroring the wardrobe-compilation worker route.
const EXECUTION_BUDGET_MS = 260_000;

export async function runPreviewWorker(environment: ServerEnvironment) {
  const startedAt = Date.now();
  const admin = createAdminClient();
  await enqueueScheduledPreviewJobs(admin, environment).catch(() => {
    // Scheduled-priority enqueue is best-effort; a failure here must never
    // block the core claim/process loop below.
  });

  let claimed = 0;
  let completed = 0;
  let failed = 0;
  let superseded = 0;
  while (Date.now() - startedAt < EXECUTION_BUDGET_MS) {
    const batch = await processOutfitPreviewBatch(10);
    claimed += batch.claimed;
    completed += batch.completed;
    failed += batch.failed;
    superseded += batch.superseded;
    if (batch.claimed === 0) break;
  }

  return { claimed, completed, failed, superseded };
}
