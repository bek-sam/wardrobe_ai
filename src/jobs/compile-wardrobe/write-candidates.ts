import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";

import { fetchReusableCandidateFields } from "./fetch-reusable-candidate-fields";
import type { AdminClient } from "./types";
import { upsertCandidateItems } from "./upsert-candidate-items";
import { upsertCandidateRows } from "./upsert-candidate-rows";

// Versioned publish: inserts the new version's rows as genuinely new rows
// (never a delete-then-insert, and never a same-combination-key update onto a
// row belonging to a different version -- the unique constraint is scoped to
// (user_id, compiled_wardrobe_version, combination_key) precisely so this
// insert can't collide across versions). finalize_wardrobe_compilation() is
// the only thing that flips the published-version pointer, after verifying
// this count, so a crash mid-write here just leaves inert unpublished rows.
export async function writeCandidates(
  admin: AdminClient,
  userId: string,
  jobId: string,
  compiledWardrobeVersion: string,
  previousVersion: string | null,
  affectedItemIds: ReadonlySet<string>,
  candidates: readonly GeneratedOutfitCandidate[],
): Promise<Map<string, string>> {
  if (candidates.length === 0) return new Map();

  const unaffectedKeys = candidates
    .filter((candidate) => !candidate.items.some((item) => affectedItemIds.has(item.itemId)))
    .map((candidate) => candidate.combinationKey);
  const reusableByCombinationKey = previousVersion
    ? await fetchReusableCandidateFields(admin, userId, previousVersion, unaffectedKeys)
    : new Map();

  const candidateIdByCombinationKey = await upsertCandidateRows(
    admin,
    userId,
    jobId,
    compiledWardrobeVersion,
    candidates,
    reusableByCombinationKey,
  );
  await upsertCandidateItems(admin, userId, candidates, candidateIdByCombinationKey);

  return candidateIdByCombinationKey;
}
