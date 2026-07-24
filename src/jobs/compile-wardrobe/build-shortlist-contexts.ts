import { computeAnalysisHash, getCachedAnalysis } from "@/lib/ai/agents/outfit-analysis-cache";
import type { CuratorCandidateInput } from "@/lib/ai/agents/outfit-curator-agent";
import { buildCuratorContext } from "@/lib/compilation/build-curator-context";
import type { CuratorCandidateDecision } from "@/lib/ai/schemas/outfit-curator";

import type { WardrobeItem } from "@/features/wardrobe/types";

import { buildAnalysisHashInput } from "./build-analysis-hash-input";
import { resolveCandidateItems } from "./resolve-candidate-items";
import { toGeneratedCandidate } from "./to-generated-candidate";
import type { AdminClient, CuratorCandidateRow } from "./types";
import type { PreferenceContext } from "./load-preference-context";

export async function buildShortlistContexts(
  admin: AdminClient,
  userId: string,
  curatorModel: string,
  preferences: PreferenceContext,
  createdItemIds: ReadonlySet<string>,
  shortlistRows: readonly CuratorCandidateRow[],
  itemsById: ReadonlyMap<string, WardrobeItem>,
) {
  const contexts: CuratorCandidateInput[] = [];
  const hashByCandidateId = new Map<string, string>();
  const candidateKeyById = new Map<string, string>();
  const cacheHitDecisions: CuratorCandidateDecision[] = [];

  for (const row of shortlistRows) {
    const resolvedItems = resolveCandidateItems(row, itemsById);
    if (!resolvedItems) continue;
    candidateKeyById.set(row.id, row.combination_key);

    const hash = computeAnalysisHash(
      buildAnalysisHashInput(
        row,
        resolvedItems.map((item) => item.id),
        Object.fromEntries(resolvedItems.map((item) => [item.id, item.updated_at])),
        curatorModel,
        preferences,
      ),
    );
    hashByCandidateId.set(row.id, hash);

    const cached = await getCachedAnalysis(admin, userId, hash);
    if (cached) {
      cacheHitDecisions.push({ ...cached, candidateId: row.id });
    } else {
      contexts.push(
        buildCuratorContext(row.id, toGeneratedCandidate(row), resolvedItems, createdItemIds),
      );
    }
  }

  return { contexts, hashByCandidateId, candidateKeyById, cacheHitDecisions };
}
