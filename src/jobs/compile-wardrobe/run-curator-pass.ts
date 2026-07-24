import { buildAffectedItemsShortlist, buildCatchUpShortlist } from "./build-curator-shortlists";
import { enforceMaxSelectedPerNewItem } from "./enforce-max-selected";
import { fetchCuratorCandidateRows } from "./fetch-curator-candidate-rows";
import type { PreferenceContext } from "./load-preference-context";
import { processShortlistWithBudget } from "./process-shortlist-with-budget";
import type { AdminClient, ServerEnvironment } from "./types";

// Bounded, cache-aware curator pass: at most environment.WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION
// model calls regardless of how many wardrobe items changed this run. Reads
// candidates directly from the just-published (or, on the no-op path,
// already-published) version so it works identically either way. Any
// failure inside this function is caught by the caller -- candidates simply
// keep curator_status='not_reviewed' and the deterministic library remains
// fully usable; the next compile's "catch-up" shortlist retries them.
export async function runCuratorPass(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  preferences: PreferenceContext,
  compiledWardrobeVersion: string,
  affectedItemIds: ReadonlySet<string>,
  createdItemIds: ReadonlySet<string>,
): Promise<{ calls: number }> {
  const perCall = environment.WARDROBE_CURATOR_MAX_CANDIDATES;
  const maxCalls = environment.WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION;

  const { rows, itemsById } = await fetchCuratorCandidateRows(
    admin,
    userId,
    compiledWardrobeVersion,
  );
  if (rows.length === 0) return { calls: 0 };

  const shortlistA = buildAffectedItemsShortlist(rows, affectedItemIds, perCall);
  const usedIds = new Set(shortlistA.map((row) => row.id));
  const args = [admin, userId, environment, preferences, createdItemIds] as const;

  let callsMade = await processShortlistWithBudget(...args, shortlistA, itemsById, 0, maxCalls);
  const shortlistB = buildCatchUpShortlist(rows, usedIds, perCall);
  callsMade = await processShortlistWithBudget(...args, shortlistB, itemsById, callsMade, maxCalls);

  if (createdItemIds.size > 0) {
    await enforceMaxSelectedPerNewItem(
      admin,
      userId,
      createdItemIds,
      environment.WARDROBE_CURATOR_MAX_SELECTED_PER_NEW_ITEM,
    );
  }

  return { calls: callsMade };
}
