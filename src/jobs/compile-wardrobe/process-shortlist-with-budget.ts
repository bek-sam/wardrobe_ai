import type { WardrobeItem } from "@/features/wardrobe/types";

import type { PreferenceContext } from "./load-preference-context";
import { processCuratorShortlist } from "./process-curator-shortlist";
import type { AdminClient, CuratorCandidateRow, ServerEnvironment } from "./types";

export async function processShortlistWithBudget(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  preferences: PreferenceContext,
  createdItemIds: ReadonlySet<string>,
  shortlistRows: readonly CuratorCandidateRow[],
  itemsById: ReadonlyMap<string, WardrobeItem>,
  callsMade: number,
  maxCalls: number,
): Promise<number> {
  if (callsMade >= maxCalls) return callsMade;
  const made = await processCuratorShortlist(
    admin,
    userId,
    environment,
    preferences,
    createdItemIds,
    shortlistRows,
    itemsById,
  );
  return made ? callsMade + 1 : callsMade;
}
