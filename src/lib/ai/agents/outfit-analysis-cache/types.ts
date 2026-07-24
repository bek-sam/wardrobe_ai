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
