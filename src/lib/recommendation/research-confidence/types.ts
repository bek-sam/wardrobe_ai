import type { ResearchMatchStatus, ResearchSourceType } from "./constants.data";

export interface ResearchConfidenceInput {
  confidence?: number | null;
  sourceTypes?: readonly ResearchSourceType[];
  exactIdentifierMatch?: boolean;
  userConfirmedBrand?: boolean;
  matchingTextClues?: number;
  visualSimilarityOnly?: boolean;
  candidateFound?: boolean;
}

export interface ResearchConfidenceResult {
  status: ResearchMatchStatus;
  confidence: number;
  reasons: string[];
}
