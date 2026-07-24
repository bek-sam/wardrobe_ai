import type { CuratorCandidateDecision } from "@/lib/ai/schemas/outfit-curator";

export interface AnalysisHashInput {
  itemIds: readonly string[];
  itemMetadataVersions: Readonly<Record<string, string>>;
  preferenceVersion: string;
  styleKnowledgeVersion: string;
  curatorModel: string;
  curatorPromptVersion: string;
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
