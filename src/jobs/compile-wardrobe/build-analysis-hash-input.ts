import {
  CURATOR_SIGNAL_FIELDS,
  type AnalysisHashInput,
} from "@/lib/ai/agents/outfit-analysis-cache";
import { OUTFIT_CURATOR_PROMPT_VERSION } from "@/lib/ai/prompts/outfit-curator";
import { STYLE_KNOWLEDGE_VERSION } from "@/lib/style-knowledge";

import type { PreferenceContext } from "./load-preference-context";
import type { CuratorCandidateRow } from "./types";

export function buildAnalysisHashInput(
  row: CuratorCandidateRow,
  resolvedItemIds: readonly string[],
  itemMetadataVersions: Readonly<Record<string, string>>,
  curatorModel: string,
  preferences: PreferenceContext,
): AnalysisHashInput {
  const signals = Object.fromEntries(
    CURATOR_SIGNAL_FIELDS.map(({ key, column }) => [key, row[column as keyof CuratorCandidateRow]]),
  ) as Pick<AnalysisHashInput, (typeof CURATOR_SIGNAL_FIELDS)[number]["key"]>;

  return {
    itemIds: resolvedItemIds,
    itemMetadataVersions,
    preferenceVersion: preferences.preferenceVersion,
    styleKnowledgeVersion: STYLE_KNOWLEDGE_VERSION,
    curatorModel,
    curatorPromptVersion: OUTFIT_CURATOR_PROMPT_VERSION,
    ...signals,
  };
}
