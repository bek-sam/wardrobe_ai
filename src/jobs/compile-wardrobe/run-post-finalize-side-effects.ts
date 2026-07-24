import { enqueueAutomaticPreviewJobs } from "./enqueue-automatic-previews";
import type { AdminClient, ChangeEventSummary, ServerEnvironment } from "./types";

export async function runPostFinalizeSideEffects(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  compiledWardrobeVersion: string,
  changeEvents: ChangeEventSummary,
) {
  await enqueueAutomaticPreviewJobs(
    admin,
    userId,
    environment,
    changeEvents.createdItemIds,
    compiledWardrobeVersion,
  ).catch(() => {
    // Preview enqueue is best-effort and must never affect compile status.
  });

  if (changeEvents.eventIds.length > 0) {
    await admin
      .from("wardrobe_change_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", changeEvents.eventIds)
      .is("processed_at", null);
  }
}
