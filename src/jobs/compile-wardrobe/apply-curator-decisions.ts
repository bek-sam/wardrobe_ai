import { OUTFIT_CURATOR_PROMPT_VERSION } from "@/lib/ai/prompts/outfit-curator";
import type { CuratorCandidateDecision } from "@/lib/ai/schemas/outfit-curator";

import type { AdminClient } from "./types";

// Applies each decision as its own scoped update (not a bulk upsert): the
// per-row values genuinely differ, and an upsert without every NOT NULL
// column supplied risks Postgres validating the phantom insert branch. Each
// update is scoped by id + user_id, and every id here always came from this
// user's own just-queried candidate rows, so there is no cross-user risk.
export async function applyCuratorDecisions(
  admin: AdminClient,
  userId: string,
  decisions: readonly CuratorCandidateDecision[],
  curatorModel: string,
) {
  await Promise.all(
    decisions.map((decision) =>
      admin
        .from("outfit_candidates")
        .update({
          curator_status: decision.decision === "select" ? "selected" : "rejected",
          curator_rejection_reason: decision.rejectionReason,
          curator_confidence: decision.confidence,
          curator_rank: decision.decision === "select" ? decision.rankAmongNewItemOutfits : null,
          curator_model: curatorModel,
          curator_prompt_version: OUTFIT_CURATOR_PROMPT_VERSION,
          curator_reviewed_at: new Date().toISOString(),
          style_tags: decision.decision === "select" ? decision.aestheticTags : [],
          occasion_category: decision.occasionCategory,
        })
        .eq("id", decision.candidateId)
        .eq("user_id", userId)
        .eq("status", "active"),
    ),
  );
}
