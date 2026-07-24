import {
  runOutfitCuratorAgent,
  type CuratorCandidateInput,
} from "@/lib/ai/agents/outfit-curator-agent";
import { STYLE_KNOWLEDGE_VERSION } from "@/lib/style-knowledge";

import { applyCuratorDecisions } from "./apply-curator-decisions";
import { cacheCuratorDecisions } from "./cache-curator-decisions";
import type { PreferenceContext } from "./load-preference-context";
import type { AdminClient, ServerEnvironment } from "./types";

export async function callCuratorAgentForContexts(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  preferences: PreferenceContext,
  contexts: readonly CuratorCandidateInput[],
  hashByCandidateId: ReadonlyMap<string, string>,
  candidateKeyById: ReadonlyMap<string, string>,
): Promise<boolean> {
  const { data: quota } = await admin.rpc("service_check_and_increment_usage_window", {
    p_user_id: userId,
    p_feature: "outfit_curator_calls",
    p_limit: environment.DAILY_CURATOR_CALL_LIMIT,
    p_period: "day",
    p_increment: 1,
  });
  if (!(quota as { allowed?: boolean } | null)?.allowed) return false;

  const agentResult = await runOutfitCuratorAgent({
    userId,
    candidates: [...contexts],
    userPreferences: {
      styleKeywords: preferences.styleKeywords,
      styleArchetypes: preferences.styleArchetypes,
      favoriteColors: preferences.favoriteColors,
      avoidedColors: preferences.avoidedColors,
    },
    knowledgeVersion: STYLE_KNOWLEDGE_VERSION,
  });

  await applyCuratorDecisions(admin, userId, agentResult.result.decisions, agentResult.model);
  await cacheCuratorDecisions(
    admin,
    userId,
    environment,
    agentResult.result.decisions,
    agentResult.model,
    agentResult.promptVersion,
    hashByCandidateId,
    candidateKeyById,
  );

  return true;
}
