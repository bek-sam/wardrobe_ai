import { createHash } from "node:crypto";

import { canonicalize } from "./canonicalize";
import { CURATOR_SIGNAL_FIELDS, type AnalysisHashInput } from "./types";

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
