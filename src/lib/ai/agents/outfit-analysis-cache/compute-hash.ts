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
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
