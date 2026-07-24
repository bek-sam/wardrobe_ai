import type { ImportCandidateRow } from "./types";

export function buildExtractionMetadata(candidate: ImportCandidateRow) {
  const metadata = { ...candidate.proposed_metadata, ...candidate.confirmed_metadata };
  return {
    name: typeof metadata.name === "string" ? metadata.name : null,
    category: typeof metadata.category === "string" ? metadata.category : null,
    primaryColorHex:
      typeof metadata.primary_color_hex === "string" ? metadata.primary_color_hex : null,
    secondaryColorHex:
      typeof metadata.secondary_color_hex === "string" ? metadata.secondary_color_hex : null,
    visibleDetails: Array.isArray(metadata.visible_text)
      ? metadata.visible_text.filter((value): value is string => typeof value === "string")
      : [],
  };
}
