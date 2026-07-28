import type { WardrobeIntent } from "./types";

/**
 * Weighted keyword rules for the deterministic first pass. Weights are small
 * integers: 3 = unambiguous for that intent, 2 = strong, 1 = supporting.
 * A tie always resolves to the earlier intent in INTENT_PRIORITY.
 */
export const INTENT_RULES: readonly {
  intent: WardrobeIntent;
  weight: number;
  pattern: RegExp;
}[] = [
  { intent: "packing", weight: 3, pattern: /\bpack(?:\s?ing|s|ed)?\b/ },
  { intent: "packing", weight: 3, pattern: /\b(?:suitcase|luggage|carry[-\s]?on|packing list)\b/ },
  { intent: "packing", weight: 2, pattern: /\b(?:trip|travel(?:l?ing)?|vacation|holiday)\b/ },
  { intent: "packing", weight: 2, pattern: /\bcapsule (?:wardrobe|set)\b/ },
  { intent: "packing", weight: 1, pattern: /\bwhat (?:should|do) i (?:bring|take)\b/ },
  { intent: "packing", weight: 1, pattern: /\b(?:flying|fly|drive|driving) to\b/ },

  { intent: "planning", weight: 3, pattern: /\bplan(?:\s?ning|s|ned)?\b/ },
  { intent: "planning", weight: 3, pattern: /\b(?:next|this|coming) week\b/ },
  { intent: "planning", weight: 2, pattern: /\boutfits\b/ },
  { intent: "planning", weight: 2, pattern: /\b(?:each|every) day\b/ },
  { intent: "planning", weight: 2, pattern: /\bfor the (?:week|weekend|next \d+ days)\b/ },
  { intent: "planning", weight: 1, pattern: /\b(?:schedule|calendar|agenda)\b/ },
  { intent: "planning", weight: 1, pattern: /\b\d+\s*(?:-|\s)?days?\b/ },

  { intent: "insight", weight: 3, pattern: /\bcost per wear\b/ },
  {
    intent: "insight",
    weight: 3,
    pattern: /\b(?:never|not|hardly|rarely|barely) (?:been )?worn\b/,
  },
  { intent: "insight", weight: 3, pattern: /\bhaven'?t worn\b|\bhave not worn\b|\bdon'?t wear\b/ },
  { intent: "insight", weight: 3, pattern: /\b(?:least|most) (?:worn|used)\b/ },
  { intent: "insight", weight: 2, pattern: /\b(?:insights?|analytics|statistics|stats)\b/ },
  { intent: "insight", weight: 2, pattern: /\b(?:unworn|unused|underused|neglected)\b/ },
  { intent: "insight", weight: 2, pattern: /\bwardrobe (?:gaps?|holes?|coverage|balance)\b/ },
  { intent: "insight", weight: 2, pattern: /\bwhat(?:'s| is| am i) missing\b/ },
  { intent: "insight", weight: 1, pattern: /\bwear (?:count|history|log)\b/ },
  { intent: "insight", weight: 1, pattern: /\b(?:overrepresented|too many|duplicates?)\b/ },

  { intent: "item_question", weight: 3, pattern: /\bdo i (?:own|have|still have)\b/ },
  { intent: "item_question", weight: 3, pattern: /\bhow many\b/ },
  { intent: "item_question", weight: 2, pattern: /\b(?:show|list) (?:me )?(?:my|all|the)?\b/ },
  { intent: "item_question", weight: 2, pattern: /\b(?:find|search for|look up|locate)\b/ },
  { intent: "item_question", weight: 2, pattern: /\b(?:which|what) .*\bdo i (?:own|have)\b/ },
  { intent: "item_question", weight: 2, pattern: /\bis there an?\b|\bare there any\b/ },
  { intent: "item_question", weight: 1, pattern: /\bin my (?:closet|wardrobe)\b/ },
  { intent: "item_question", weight: 1, pattern: /\bwhat colou?rs?\b/ },

  { intent: "outfit_request", weight: 3, pattern: /\b(?:dress|style) me\b/ },
  { intent: "outfit_request", weight: 3, pattern: /\bwhat should i wear\b/ },
  { intent: "outfit_request", weight: 2, pattern: /\ban? [\w\s-]{0,24}(?:outfit|look)\b/ },
  { intent: "outfit_request", weight: 2, pattern: /\b(?:goes|go|pair) with\b/ },
  { intent: "outfit_request", weight: 1, pattern: /\bput together\b/ },
  { intent: "outfit_request", weight: 1, pattern: /\bwear (?:today|tonight|now)\b/ },
];

/** Ties resolve to the earliest intent listed here (safest default first). */
export const INTENT_PRIORITY: readonly WardrobeIntent[] = [
  "outfit_request",
  "item_question",
  "insight",
  "packing",
  "planning",
];

export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** Index matches Date#getUTCDay (0 = Sunday). */
export const WEEKDAY_NAMES: readonly string[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Signals that a planning request really covers more than a single day. */
export const MULTI_DAY_MARKERS: readonly RegExp[] = [
  /\boutfits\b/,
  /\b(?:each|every) day\b/,
  /\bweek(?:end)?\b/,
  /\bdays\b/,
  /\bmon|tues|wednes|thurs|fri|satur|sun/,
];
