import type { WardrobeItem } from "@/features/wardrobe/types";
import { generateOutfitCandidates } from "@/lib/compilation/generate-outfit-candidates";

import type { PreferenceContext } from "./load-preference-context";
import type { AdminClient, ChangeEventSummary, ServerEnvironment } from "./types";
import { writeCandidates } from "./write-candidates";

export async function generateOrReuseCandidates(
  admin: AdminClient,
  userId: string,
  jobId: string,
  items: readonly WardrobeItem[],
  preferences: PreferenceContext,
  environment: ServerEnvironment,
  changeEvents: ChangeEventSummary,
  initialState: { compiled_wardrobe_version?: unknown; candidate_count?: unknown } | null,
  generatedVersion: string,
): Promise<{ compiledWardrobeVersion: string; isNewVersion: boolean; candidateCount: number }> {
  const isNoOp =
    changeEvents.affectedItemIds.size === 0 &&
    !changeEvents.hasPreferenceChange &&
    Boolean(initialState?.compiled_wardrobe_version);

  if (isNoOp) {
    // Nothing changed since the last publish: republish the current
    // version as-is (zero new candidate/candidate-item writes) instead of
    // regenerating and re-upserting an unaffected library.
    return {
      compiledWardrobeVersion: initialState!.compiled_wardrobe_version as string,
      isNewVersion: false,
      candidateCount: (initialState?.candidate_count as number | undefined) ?? 0,
    };
  }

  const candidates = generateOutfitCandidates(items, {
    preferences,
    maxCandidates: environment.WARDROBE_COMPILATION_MAX_CANDIDATES,
    maxFoundationsPerBucket: environment.WARDROBE_COMPILATION_MAX_FOUNDATIONS_PER_BUCKET,
  });
  await writeCandidates(
    admin,
    userId,
    jobId,
    generatedVersion,
    (initialState?.compiled_wardrobe_version as string | undefined) ?? null,
    changeEvents.affectedItemIds,
    candidates,
  );
  return {
    compiledWardrobeVersion: generatedVersion,
    isNewVersion: true,
    candidateCount: candidates.length,
  };
}
