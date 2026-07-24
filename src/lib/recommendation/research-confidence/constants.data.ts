export const RESEARCH_MATCH_STATUSES = ["verified", "likely", "uncertain", "not_found"] as const;
export const RESEARCH_SOURCE_TYPES = [
  "official_brand",
  "retailer",
  "marketplace",
  "other",
] as const;

export type ResearchMatchStatus = (typeof RESEARCH_MATCH_STATUSES)[number];
export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];
