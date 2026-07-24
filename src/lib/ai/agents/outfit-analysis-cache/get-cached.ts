import type { SupabaseClient } from "@supabase/supabase-js";

import {
  curatorCandidateDecisionSchema,
  type CuratorCandidateDecision,
} from "@/lib/ai/schemas/outfit-curator";

export async function getCachedAnalysis(
  admin: SupabaseClient,
  userId: string,
  hash: string,
): Promise<CuratorCandidateDecision | null> {
  const { data } = await admin
    .from("outfit_analysis_cache")
    .select("structured_result, expires_at")
    .eq("user_id", userId)
    .eq("analysis_hash", hash)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;

  const parsed = curatorCandidateDecisionSchema.safeParse(data.structured_result);
  return parsed.success ? parsed.data : null;
}
