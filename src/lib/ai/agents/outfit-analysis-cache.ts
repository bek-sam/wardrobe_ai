import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  curatorCandidateDecisionSchema,
  type CuratorCandidateDecision,
} from "@/lib/ai/schemas/outfit-curator";

export interface AnalysisHashInput {
  itemIds: readonly string[];
  itemMetadataVersions: Readonly<Record<string, string>>;
  preferenceVersion: string;
  styleKnowledgeVersion: string;
  curatorModel: string;
  curatorPromptVersion: string;
}

// Canonical, key-sorted JSON so object-key order never changes the hash.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = canonicalize((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value;
}

export function computeAnalysisHash(input: AnalysisHashInput): string {
  const canonical = canonicalize({
    itemIds: [...input.itemIds].sort(),
    itemMetadataVersions: input.itemMetadataVersions,
    preferenceVersion: input.preferenceVersion,
    styleKnowledgeVersion: input.styleKnowledgeVersion,
    curatorModel: input.curatorModel,
    curatorPromptVersion: input.curatorPromptVersion,
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

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

export interface WriteCachedAnalysisInput {
  userId: string;
  hash: string;
  candidateKey: string;
  model: string;
  promptVersion: string;
  knowledgeVersion: string;
  decision: CuratorCandidateDecision;
  ttlDays: number;
}

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
