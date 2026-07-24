import type { CuratorCandidateDecision } from "@/lib/ai/schemas/outfit-curator";

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
