import { runPostFinalizeSideEffects } from "./run-post-finalize-side-effects";
import type { AdminClient, ChangeEventSummary, ServerEnvironment } from "./types";

export async function finalizeAndCleanup(
  admin: AdminClient,
  userId: string,
  jobId: string,
  environment: ServerEnvironment,
  compiledWardrobeVersion: string,
  startChangeCount: number,
  candidateCount: number,
  itemsConsidered: number,
  changeEvents: ChangeEventSummary,
  curatorCalls: number,
) {
  const { data: finalizeResult, error: finalizeError } = await admin.rpc(
    "finalize_wardrobe_compilation",
    {
      p_job_id: jobId,
      p_user_id: userId,
      p_new_version: compiledWardrobeVersion,
      p_start_change_count: startChangeCount,
      p_candidate_count: candidateCount,
      p_items_considered: itemsConsidered,
    },
  );
  if (finalizeError) throw finalizeError;

  await runPostFinalizeSideEffects(
    admin,
    userId,
    environment,
    compiledWardrobeVersion,
    changeEvents,
  );

  return {
    jobId,
    status: "complete" as const,
    candidatesGenerated: candidateCount,
    itemsConsidered,
    curatorCalls,
    changedDuringRun: Boolean(
      finalizeResult && typeof finalizeResult === "object" && "changed_during_run" in finalizeResult
        ? finalizeResult.changed_during_run
        : false,
    ),
  };
}
