import type { AnalysisHashInput } from "@/lib/ai/agents/outfit-analysis-cache";
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
  return {
    itemIds: resolvedItemIds,
    itemMetadataVersions,
    preferenceVersion: preferences.preferenceVersion,
    styleKnowledgeVersion: STYLE_KNOWLEDGE_VERSION,
    curatorModel,
    curatorPromptVersion: OUTFIT_CURATOR_PROMPT_VERSION,
    occasionCategory: row.occasion_category,
    totalScore: row.total_score,
    formalityLevel: row.formality_level,
    warmthLevel: row.warmth_level,
    colorHarmony: row.color_harmony,
    layeringQuality: row.layering_quality,
    occasionFormality: row.occasion_formality,
    preferenceMatch: row.preference_match,
    variety: row.variety,
  };
}
