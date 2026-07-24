import { createHash } from "node:crypto";

import { canonicalize } from "./canonicalize";
import type { AnalysisHashInput } from "./types";

export function computeAnalysisHash(input: AnalysisHashInput): string {
  const canonical = canonicalize({
    itemIds: [...input.itemIds].sort(),
    itemMetadataVersions: input.itemMetadataVersions,
    preferenceVersion: input.preferenceVersion,
    styleKnowledgeVersion: input.styleKnowledgeVersion,
    curatorModel: input.curatorModel,
    curatorPromptVersion: input.curatorPromptVersion,
    occasionCategory: input.occasionCategory,
    totalScore: input.totalScore,
    formalityLevel: input.formalityLevel,
    warmthLevel: input.warmthLevel,
    colorHarmony: input.colorHarmony,
    layeringQuality: input.layeringQuality,
    occasionFormality: input.occasionFormality,
    preferenceMatch: input.preferenceMatch,
    variety: input.variety,
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
