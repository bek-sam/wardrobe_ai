export const WARDROBE_INTENTS = [
  "outfit_request",
  "planning",
  "packing",
  "insight",
  "item_question",
] as const;

export type WardrobeIntent = (typeof WARDROBE_INTENTS)[number];

export const INSIGHT_FOCUSES = [
  "unworn",
  "least_worn",
  "most_worn",
  "cost_per_wear",
  "gaps",
  "overview",
] as const;

export type InsightFocus = (typeof INSIGHT_FOCUSES)[number];

/** Inclusive calendar range, already clamped to the supported planning window. */
export type IntentDateRange = {
  startDate: string;
  endDate: string;
  dayCount: number;
  label: string;
};

export type ItemQuery = {
  raw: string;
  terms: string[];
  colors: string[];
  categories: string[];
  favoritesOnly: boolean;
  availableOnly: boolean;
};

export type IntentScore = { intent: WardrobeIntent; confidence: number };

export type ResolvedIntent = {
  intent: WardrobeIntent;
  confidence: number;
  /** "rules" when deterministic matching decided it, "model" after escalation. */
  source: "rules" | "model";
  /** Lowercased request text the slots were extracted from. */
  text: string;
  range: IntentDateRange | null;
  destination: string | null;
  insightFocus: InsightFocus;
  /** ISO date: wear activity before this date counts as "not worn". */
  unwornSince: string | null;
  itemQuery: ItemQuery;
};
