import type { SupabaseClient } from "@supabase/supabase-js";

import type { WriteCachedAnalysisInput } from "./types";

export async function writeCachedAnalysis(admin: SupabaseClient, input: WriteCachedAnalysisInput) {
  const expiresAt = new Date(Date.now() + input.ttlDays * 24 * 60 * 60 * 1_000).toISOString();
  await admin.from("outfit_analysis_cache").upsert(
    {
      user_id: input.userId,
      analysis_hash: input.hash,
      candidate_key: input.candidateKey,
      model: input.model,
      prompt_version: input.promptVersion,
      knowledge_version: input.knowledgeVersion,
      structured_result: input.decision,
      expires_at: expiresAt,
    },
    { onConflict: "user_id,analysis_hash" },
  );
}
