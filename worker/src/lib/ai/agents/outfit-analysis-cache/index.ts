import type { CuratorCandidateDecision } from "@/lib/ai/schemas";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { curatorCandidateDecisionSchema } from "@/lib/ai/schemas";

export interface AnalysisHashInput {
  itemIds: readonly string[];
  itemMetadataVersions: Readonly<Record<string, string>>;
  preferenceVersion: string;
  styleKnowledgeVersion: string;
  curatorModel: string;
  curatorPromptVersion: string;
  // Candidate-context inputs the curator actually reads (and, for
  // occasionCategory, can reassign): omitting these let a cached decision
  // outlive a context change even though the garments themselves hadn't
  // changed. Style-knowledge annotations are deliberately NOT included here
  // -- they're a pure function of itemIds/itemMetadataVersions/
  // styleKnowledgeVersion, all three already hashed above.
  occasionCategory: string | null;
  totalScore: number;
  formalityLevel: number | null;
  warmthLevel: number | null;
  colorHarmony: number | null;
  layeringQuality: number | null;
  occasionFormality: number | null;
  preferenceMatch: number | null;
  variety: number | null;
}

// Single source of truth for the curator numeric-signal fields shared
// between AnalysisHashInput, computeAnalysisHash's canonicalization, and
// buildAnalysisHashInput's row mapping -- previously each hand-listed the
// same 9 field names independently, risking one being missed when a 10th
// signal is added later.
export const CURATOR_SIGNAL_FIELDS = [
  { key: "occasionCategory", column: "occasion_category" },
  { key: "totalScore", column: "total_score" },
  { key: "formalityLevel", column: "formality_level" },
  { key: "warmthLevel", column: "warmth_level" },
  { key: "colorHarmony", column: "color_harmony" },
  { key: "layeringQuality", column: "layering_quality" },
  { key: "occasionFormality", column: "occasion_formality" },
  { key: "preferenceMatch", column: "preference_match" },
  { key: "variety", column: "variety" },
] as const satisfies readonly { key: keyof AnalysisHashInput; column: string }[];

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
  const signals = Object.fromEntries(CURATOR_SIGNAL_FIELDS.map(({ key }) => [key, input[key]]));
  const canonical = canonicalize({
    itemIds: [...input.itemIds].sort(),
    itemMetadataVersions: input.itemMetadataVersions,
    preferenceVersion: input.preferenceVersion,
    styleKnowledgeVersion: input.styleKnowledgeVersion,
    curatorModel: input.curatorModel,
    curatorPromptVersion: input.curatorPromptVersion,
    ...signals,
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
