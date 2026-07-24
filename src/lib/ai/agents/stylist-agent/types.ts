export type StylistCandidate = {
  id: string;
  name: string;
  role: string | null;
  category: string;
  colors: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  warmthLevel: number | null;
  formalityLevel: number | null;
  occasionTags: readonly string[];
  weatherTags: readonly string[];
  score: number;
};

export type StylistAgentInput = {
  userId: string;
  request: string;
  candidates: readonly StylistCandidate[];
  weather?: unknown;
  preferences?: unknown;
  recentWear?: unknown;
  occasion?: string | null;
};

export type ExplainWardrobeCandidateInput = {
  userId: string;
  request: string;
  items: readonly StylistCandidate[];
  weather?: unknown;
  preferences?: unknown;
  recentWear?: unknown;
  occasion?: string | null;
};
