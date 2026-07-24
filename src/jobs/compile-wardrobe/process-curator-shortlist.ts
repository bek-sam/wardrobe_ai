import type { WardrobeItem } from "@/features/wardrobe/types";

import { applyCuratorDecisions } from "./apply-curator-decisions";
import { buildShortlistContexts } from "./build-shortlist-contexts";
import { callCuratorAgentForContexts } from "./call-curator-agent-for-contexts";
import type { PreferenceContext } from "./load-preference-context";
import type { AdminClient, CuratorCandidateRow, ServerEnvironment } from "./types";

// Processes one shortlist and returns whether a model call was actually made,
// so the caller can track the per-compilation call budget across multiple
// shortlists (affected-items pass, then catch-up pass).
export async function processCuratorShortlist(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  preferences: PreferenceContext,
  createdItemIds: ReadonlySet<string>,
  shortlistRows: readonly CuratorCandidateRow[],
  itemsById: ReadonlyMap<string, WardrobeItem>,
): Promise<boolean> {
  if (shortlistRows.length === 0 || !environment.OPENAI_CURATOR_MODEL) return false;

  const { contexts, hashByCandidateId, candidateKeyById, cacheHitDecisions } =
    await buildShortlistContexts(
      admin,
      userId,
      environment.OPENAI_CURATOR_MODEL,
      preferences,
      createdItemIds,
      shortlistRows,
      itemsById,
    );

  if (cacheHitDecisions.length > 0) {
    await applyCuratorDecisions(admin, userId, cacheHitDecisions, environment.OPENAI_CURATOR_MODEL);
  }
  if (contexts.length === 0) return false;

  return callCuratorAgentForContexts(
    admin,
    userId,
    environment,
    preferences,
    contexts,
    hashByCandidateId,
    candidateKeyById,
  );
}
