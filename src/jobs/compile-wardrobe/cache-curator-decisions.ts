import { writeCachedAnalysis } from "@/lib/ai/agents/outfit-analysis-cache";
import type { CuratorCandidateDecision } from "@/lib/ai/schemas/outfit-curator";
import { STYLE_KNOWLEDGE_VERSION } from "@/lib/style-knowledge";

import type { AdminClient, ServerEnvironment } from "./types";

export async function cacheCuratorDecisions(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  decisions: readonly CuratorCandidateDecision[],
  model: string,
  promptVersion: string,
  hashByCandidateId: ReadonlyMap<string, string>,
  candidateKeyById: ReadonlyMap<string, string>,
) {
  await Promise.all(
    decisions.map((decision) =>
      writeCachedAnalysis(admin, {
        userId,
        hash: hashByCandidateId.get(decision.candidateId) ?? decision.candidateId,
        candidateKey: candidateKeyById.get(decision.candidateId) ?? decision.candidateId,
        model,
        promptVersion,
        knowledgeVersion: STYLE_KNOWLEDGE_VERSION,
        decision,
        ttlDays: environment.OUTFIT_ANALYSIS_CACHE_TTL_DAYS,
      }),
    ),
  );
}
