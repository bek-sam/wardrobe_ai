import type { WardrobeItem } from "@/features/wardrobe/types";

import { finalizeAndCleanup } from "./finalize-and-cleanup";
import type { PreferenceContext } from "./load-preference-context";
import { runCuratorPassSafely } from "./run-curator-pass-safely";
import type { AdminClient, ChangeEventSummary, ServerEnvironment } from "./types";

// Called only after compiledWardrobeVersion/isNewVersion are already
// reassigned in the caller's scope, so any throw here is still handled with
// the correct (possibly reused, not freshly generated) version identifier.
export async function finishCompilation(
  admin: AdminClient,
  userId: string,
  jobId: string,
  environment: ServerEnvironment,
  compiledWardrobeVersion: string,
  candidateCount: number,
  items: readonly WardrobeItem[],
  preferences: PreferenceContext,
  startChangeCount: number,
  changeEvents: ChangeEventSummary,
) {
  const curatorCalls = await runCuratorPassSafely(
    admin,
    userId,
    environment,
    preferences,
    compiledWardrobeVersion,
    changeEvents,
  );

  return finalizeAndCleanup(
    admin,
    userId,
    jobId,
    environment,
    compiledWardrobeVersion,
    startChangeCount,
    candidateCount,
    items.length,
    changeEvents,
    curatorCalls,
  );
}
