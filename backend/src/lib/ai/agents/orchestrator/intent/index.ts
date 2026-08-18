import {
  canClassifyWardrobeIntentWithModel,
  classifyWardrobeIntentWithModel,
} from "./model-classifier";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;

export function isIsoDate(value: string) {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function toUtcTime(isoDate: string) {
  return Date.parse(`${isoDate}T00:00:00.000Z`);
}

export function fromUtcTime(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  return fromUtcTime(toUtcTime(isoDate) + days * DAY_MS);
}

/** Whole days from `start` to `end`, inclusive of both endpoints. */
export function inclusiveDayCount(start: string, end: string) {
  return Math.floor((toUtcTime(end) - toUtcTime(start)) / DAY_MS) + 1;
}

/** 0 = Sunday, matching Date#getUTCDay. */
export function weekdayIndex(isoDate: string) {
  return new Date(toUtcTime(isoDate)).getUTCDay();
}

export function monthsBefore(isoDate: string, months: number) {
  const date = new Date(toUtcTime(isoDate));
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export function startOfYear(isoDate: string) {
  return `${isoDate.slice(0, 4)}-01-01`;
}

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

/** save_generated_week and the planner route both cap a plan at seven days. */
export const MAX_INTENT_RANGE_DAYS = 7;

export function buildIntentRange(
  startDate: string,
  dayCount: number,
  label: string,
): IntentDateRange {
  const days = Math.min(Math.max(1, Math.trunc(dayCount)), MAX_INTENT_RANGE_DAYS);
  return { startDate, endDate: addDays(startDate, days - 1), dayCount: days, label };
}

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

function scoreWardrobeIntents(text: string) {
  const scores = new Map<WardrobeIntent, number>();
  for (const rule of INTENT_RULES) {
    if (!rule.pattern.test(text)) continue;
    scores.set(rule.intent, (scores.get(rule.intent) ?? 0) + rule.weight);
  }
  return scores;
}

/**
 * Deterministic keyword classification. Confidence grows with the winning
 * score and with how far it beats the runner-up, so genuinely mixed requests
 * ("something nice for later") stay low enough for model escalation.
 */
export function classifyWardrobeIntentDetailed(request: string): IntentScore {
  const ranked = [...scoreWardrobeIntents(request.toLowerCase()).entries()].sort(
    ([firstIntent, firstScore], [secondIntent, secondScore]) =>
      secondScore - firstScore ||
      INTENT_PRIORITY.indexOf(firstIntent) - INTENT_PRIORITY.indexOf(secondIntent),
  );
  const top = ranked[0];
  if (!top) return { intent: "outfit_request", confidence: 0.35 };
  const margin = top[1] - (ranked[1]?.[1] ?? 0);
  const confidence = Math.min(0.95, 0.35 + 0.08 * top[1] + 0.12 * margin);
  return { intent: top[0], confidence: Number(confidence.toFixed(2)) };
}

export function classifyWardrobeIntent(request: string): WardrobeIntent {
  return classifyWardrobeIntentDetailed(request).intent;
}

const SATURDAY = 6;

function nextWeekday(baseDate: string, targetIndex: number, allowToday: boolean) {
  const offset = (targetIndex - weekdayIndex(baseDate) + 7) % 7;
  return addDays(baseDate, offset === 0 && !allowToday ? 7 : offset);
}

/** "this weekend", "next week", "the rest of this week". */
export function weekRange(text: string, baseDate: string): IntentDateRange | null {
  if (/\b(?:this|the|coming|next|upcoming) weekend\b|\bweekend\b/.test(text)) {
    const isNext = /\bnext weekend\b/.test(text);
    const saturday = nextWeekday(isNext ? addDays(baseDate, 7) : baseDate, SATURDAY, !isNext);
    return buildIntentRange(saturday, 2, isNext ? "next weekend" : "this weekend");
  }
  if (/\b(?:next|coming|following|upcoming) week\b/.test(text)) {
    return buildIntentRange(nextWeekday(baseDate, 1, false), MAX_INTENT_RANGE_DAYS, "next week");
  }
  if (/\b(?:this|the) week\b|\brest of the week\b/.test(text)) {
    const remaining = 7 - weekdayIndex(baseDate) || 7;
    return buildIntentRange(baseDate, remaining, "this week");
  }
  return null;
}

const DAY_COUNT = /\b(\d{1,2}|[a-z]{3,5})[\s-]?(?:day|days|night|nights)\b/;

/** Dates the user spelled out (2026-08-03) or an explicit "for 4 days". */
function explicitDateRange(text: string, baseDate: string): IntentDateRange | null {
  const dates = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)]
    .map((match) => match[0])
    .filter(isIsoDate)
    .sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (start && end && start !== end) {
    return buildIntentRange(start, inclusiveDayCount(start, end), `${start} to ${end}`);
  }
  if (start) return buildIntentRange(start, 1, start);

  const counted = DAY_COUNT.exec(text)?.[1];
  if (!counted) return null;
  const dayCount = Number.isNaN(Number(counted)) ? (NUMBER_WORDS[counted] ?? 0) : Number(counted);
  if (dayCount < 1) return null;
  return buildIntentRange(baseDate, dayCount, `${Math.min(dayCount, 7)} days`);
}

/** "today", "tomorrow", "the day after tomorrow", or a named weekday. */
function relativeDayRange(text: string, baseDate: string): IntentDateRange | null {
  if (/\bday after tomorrow\b/.test(text)) {
    return buildIntentRange(addDays(baseDate, 2), 1, "the day after tomorrow");
  }
  if (/\btomorrow\b/.test(text)) return buildIntentRange(addDays(baseDate, 1), 1, "tomorrow");
  if (/\b(?:today|tonight|this (?:morning|afternoon|evening))\b/.test(text)) {
    return buildIntentRange(baseDate, 1, "today");
  }

  for (const [index, name] of WEEKDAY_NAMES.entries()) {
    if (!new RegExp(`\\b${name}\\b`).test(text)) continue;
    const offset = (index - weekdayIndex(baseDate) + 7) % 7;
    const isNext = /\bnext\b/.test(text);
    return buildIntentRange(addDays(baseDate, offset === 0 && isNext ? 7 : offset), 1, name);
  }
  return null;
}

/**
 * Resolves the calendar window a request talks about, relative to the date the
 * caller supplied (never the server clock, so a user's own timezone wins).
 * Returns null when the text names no window at all; callers decide the default.
 */
export function resolveRequestDateRange(text: string, baseDate: string): IntentDateRange | null {
  return (
    explicitDateRange(text, baseDate) ??
    weekRange(text, baseDate) ??
    relativeDayRange(text, baseDate)
  );
}

/** Colour words a user is likely to search their own wardrobe with. */
export const COLOR_WORDS: ReadonlySet<string> = new Set([
  "black",
  "white",
  "grey",
  "gray",
  "charcoal",
  "navy",
  "blue",
  "denim",
  "red",
  "burgundy",
  "maroon",
  "pink",
  "purple",
  "green",
  "olive",
  "teal",
  "yellow",
  "mustard",
  "orange",
  "brown",
  "tan",
  "camel",
  "beige",
  "cream",
  "ivory",
  "khaki",
  "gold",
  "silver",
]);

/** Garment words that should behave as a category filter, not a loose term. */
export const GARMENT_WORDS: ReadonlySet<string> = new Set([
  "shirt",
  "t-shirt",
  "tshirt",
  "tee",
  "blouse",
  "top",
  "sweater",
  "jumper",
  "hoodie",
  "sweatshirt",
  "cardigan",
  "blazer",
  "jacket",
  "coat",
  "parka",
  "vest",
  "dress",
  "skirt",
  "pant",
  "trouser",
  "jean",
  "chino",
  "short",
  "suit",
  "shoe",
  "sneaker",
  "trainer",
  "boot",
  "heel",
  "sandal",
  "loafer",
  "scarf",
  "hat",
  "cap",
  "belt",
  "bag",
  "sock",
  "tie",
  "glove",
]);

/** Dropped before matching: they carry no wardrobe meaning on their own. */
export const QUERY_STOPWORDS: ReadonlySet<string> = new Set([
  "do",
  "does",
  "did",
  "id",
  "own",
  "owns",
  "have",
  "has",
  "had",
  "any",
  "all",
  "the",
  "and",
  "or",
  "but",
  "for",
  "from",
  "with",
  "that",
  "this",
  "these",
  "those",
  "there",
  "here",
  "what",
  "which",
  "who",
  "whose",
  "how",
  "many",
  "much",
  "show",
  "list",
  "find",
  "get",
  "give",
  "tell",
  "search",
  "look",
  "locate",
  "please",
  "still",
  "got",
  "are",
  "is",
  "was",
  "were",
  "am",
  "my",
  "mine",
  "me",
  "you",
  "your",
  "some",
  "something",
  "anything",
  "wardrobe",
  "closet",
  "clothes",
  "clothing",
  "item",
  "items",
  "piece",
  "pieces",
  "in",
  "on",
  "at",
  "to",
  "of",
  "it",
  "its",
  "not",
  "no",
  "own?",
]);

/**
 * Words that end a destination phrase. Place-name connectors ("de", "del",
 * "la", "the", "upon", "on") are deliberately absent so "Rio de Janeiro",
 * "The Hague", and "Stratford upon Avon" survive intact; a bare "on" is only
 * cut when a date or weekday follows it (see destination-clean.ts).
 */
export const DESTINATION_STOP_WORDS: ReadonlySet<string> = new Set([
  "next",
  "this",
  "last",
  "coming",
  "upcoming",
  "following",
  "tomorrow",
  "today",
  "tonight",
  "starting",
  "start",
  "from",
  "during",
  "over",
  "because",
  "with",
  "without",
  "and",
  "but",
  "plus",
  "then",
  "while",
  "when",
  "where",
  "if",
  "so",
  "for",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

/**
 * A phrase made only of these is not a place: weekdays, generic errands, and
 * weather or season words that follow "in" ("what should I wear in rain").
 */
export const NON_DESTINATION_WORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "my",
  "some",
  "i",
  "it",
  "there",
  "here",
  "day",
  "days",
  "night",
  "nights",
  "week",
  "weeks",
  "weekend",
  "month",
  "months",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "today",
  "tomorrow",
  "tonight",
  "morning",
  "afternoon",
  "evening",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "work",
  "home",
  "office",
  "school",
  "gym",
  "bed",
  "rain",
  "rainy",
  "snow",
  "snowy",
  "sun",
  "sunshine",
  "heat",
  "cold",
  "wind",
  "windy",
  "humidity",
  "summer",
  "winter",
  "spring",
  "autumn",
  "fall",
  "general",
  "everything",
  "anything",
]);

/** Never treated as a trip destination even when capitalised mid-sentence. */
export const BLOCKED_DESTINATIONS: ReadonlySet<string> = new Set([
  "i",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "today",
  "tomorrow",
  "tonight",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "work",
  "home",
  "the office",
]);

const NUMBER_WORD = Object.keys(NUMBER_WORDS).join("|");

/** "for 3 days", "three nights", "a few weeks" -- never part of a place name. */
const LEADING_DURATION = new RegExp(
  `^(?:for\\s+)?(?:a\\s+(?:few|couple\\s+of)|\\d{1,3}|${NUMBER_WORD})\\s+(?:day|days|night|nights|week|weeks)\\b`,
  "i",
);

const LEADING_PREPOSITION = /^(?:in|at|to|around|near|over|into)\b/i;

/** "on Friday", "on the 3rd", "on 2026-08-01" -- a date, not "Newcastle on Tyne". */
const DATE_CLAUSE =
  /\s+on\s+(?:the\s+)?(?:\d|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

const STOP_CLAUSE = new RegExp(`\\s+\\b(?:${[...DESTINATION_STOP_WORDS].join("|")})\\b.*$`, "i");

const PLACE_WORD = /^[\p{L}][\p{L}'’.-]*$/u;

const MAX_WORDS = 4;

const MAX_LENGTH = 80;

/** Cuts a capture down to the phrase that could still name a place. */
function trimDestinationClause(captured: string) {
  const punctuated = captured.split(/[.,;:!?()"]/)[0] ?? "";
  const dated = punctuated.split(DATE_CLAUSE)[0] ?? "";
  return dated.replace(STOP_CLAUSE, "").trim();
}

/** Drops a leading duration ("3 days in ...") and the preposition after it. */
function stripDurationPrefix(text: string) {
  const withoutDuration = text.replace(LEADING_DURATION, "").trim();
  return withoutDuration.replace(LEADING_PREPOSITION, "").trim();
}

/** A bounded run of word-shaped tokens, or "" when nothing plausible remains. */
function boundDestination(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const word of words) {
    if (!PLACE_WORD.test(word) || kept.length === MAX_WORDS) break;
    kept.push(word);
  }
  const name = kept.join(" ").slice(0, MAX_LENGTH).trim();
  if (!name) return "";
  const lowered = name.toLowerCase().split(" ");
  return lowered.every((word) => NON_DESTINATION_WORDS.has(word)) ? "" : name;
}

/**
 * Explicit travel phrases, most specific first. All case-insensitive: a
 * destination is recognised from what the sentence says, not from whether the
 * user happened to capitalise it, so "pack me for chicago" resolves the same
 * way "Pack me for Chicago" does. The original casing is preserved in the
 * result -- this reads the request, it does not respell it.
 */
const TRAVEL_PATTERNS: readonly RegExp[] = [
  /\b(?:trip|travel(?:l?ing)?|flight|flying|fly|driving|drive|going|heading|off|visit(?:ing)?)\s+to\s+(.+)/i,
  /\bpack(?:\s?ing|s|ed)?(?:\s+me)?(?:\s+(?:a|my)\s+(?:bag|suitcase|case))?\s+for\s+(.+)/i,
  /\b(?:staying|stay|holiday(?:ing)?|vacation(?:ing)?)\s+in\s+(.+)/i,
  // "visiting Kyoto" takes no preposition, unlike "flying to Kyoto". Safe as an
  // explicit phrase because a non-place capture ("visiting the office") is
  // still rejected by the non-destination vocabulary.
  /\bvisit(?:ing|s)?\s+(.+)/i,
];

/**
 * "in <place>" is far weaker evidence than "to <place>" -- "what should I wear
 * in rain" names no trip -- so it only counts when the sentence is already
 * about travelling somewhere.
 */
const WEAK_IN_PATTERN = /\bin\s+(.+)/i;

const TRAVEL_MARKER =
  /\b(?:pack(?:\s?ing|s|ed)?|trip|travel(?:l?ing)?|vacation|holiday|suitcase|luggage|carry[-\s]?on|flying|flight)\b/i;

function candidateFrom(captured: string | undefined) {
  if (!captured) return null;
  const name = boundDestination(stripDurationPrefix(trimDestinationClause(captured)));
  return name && !BLOCKED_DESTINATIONS.has(name.toLowerCase()) ? name : null;
}

/**
 * Destination a packing request names, or null when it names none. Purely
 * deterministic: no model call, no geocoder lookup, no network at all.
 */
export function extractTripDestination(request: string): string | null {
  for (const pattern of TRAVEL_PATTERNS) {
    const name = candidateFrom(pattern.exec(request)?.[1]);
    if (name) return name;
  }
  if (!TRAVEL_MARKER.test(request)) return null;
  return candidateFrom(WEAK_IN_PATTERN.exec(request)?.[1]);
}

const PERIOD = /\b(\d{1,2}|[a-z]{3,5})\s+(month|week)s?\b/;

/** The cut-off before which a wear no longer counts as "recent". */
function resolveUnwornSince(text: string, baseDate: string) {
  if (/\bthis year\b|\ball year\b/.test(text)) return startOfYear(baseDate);
  if (/\bthis month\b/.test(text)) return `${baseDate.slice(0, 7)}-01`;
  const period = PERIOD.exec(text);
  const quantity = period?.[1];
  if (!period || !quantity) return null;
  const amount = Number.isNaN(Number(quantity)) ? (NUMBER_WORDS[quantity] ?? 0) : Number(quantity);
  if (amount < 1) return null;
  return period[2] === "month" ? monthsBefore(baseDate, amount) : addDays(baseDate, -7 * amount);
}

export function resolveInsightSlots(text: string, baseDate: string) {
  const unwornSince = resolveUnwornSince(text, baseDate);
  const focus = ((): InsightFocus => {
    if (/\bcost per wear\b|\bcost-per-wear\b|\bvalue for money\b/.test(text))
      return "cost_per_wear";
    if (/\bnever worn\b|\bunworn\b|\bunused\b|\bnot worn\b|\bhaven'?t worn\b/.test(text)) {
      return "unworn";
    }
    if (/\bhave not worn\b|\bdon'?t wear\b|\bneglected\b|\bunderused\b/.test(text)) return "unworn";
    if (/\bleast worn\b|\brarely\b|\bhardly\b|\bbarely\b/.test(text)) return "least_worn";
    if (/\bmost worn\b|\bwear (?:the )?most\b|\bgo-?to\b/.test(text)) return "most_worn";
    if (/\bgaps?\b|\bmissing\b|\bholes?\b|\bcoverage\b|\bshould i buy\b/.test(text)) return "gaps";
    return unwornSince ? "unworn" : "overview";
  })();
  return { focus, unwornSince };
}

/** Crude but predictable singularisation; matching is substring-based anyway. */
export function singularize(word: string) {
  if (/(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Turns "do I own a blue blazer?" into the tokens a wardrobe lookup needs.
 * Colours and garment words are kept separately so they can be required
 * matches rather than merely boosting the score.
 */
export function buildItemQuery(request: string): ItemQuery {
  const text = request.toLowerCase();
  const tokens = text
    .split(/[^a-z0-9'’-]+/)
    .map((token) => singularize(token.trim()))
    .filter((token) => token.length > 1 && !QUERY_STOPWORDS.has(token));

  const terms = [...new Set(tokens)];
  return {
    raw: request.trim().slice(0, 200),
    terms,
    colors: terms.filter((token) => COLOR_WORDS.has(token)),
    categories: terms.filter((token) => GARMENT_WORDS.has(token)),
    favoritesOnly: /\bfavou?rites?\b/.test(text),
    availableOnly: /\b(?:clean|available|ready to wear|not in (?:the )?laundry)\b/.test(text),
  };
}

export const DEFAULT_PLAN_DAYS = 7;

export const DEFAULT_PACKING_DAYS = 3;

export function hasMultiDayMarker(text: string) {
  return MULTI_DAY_MARKERS.some((pattern) => pattern.test(text));
}

/**
 * A "planning" request that covers a single day is really an outfit request
 * ("plan a dinner outfit", "plan what I wear tomorrow"), so it is routed to
 * the outfit path rather than spending a planner call on one look.
 */
export function collapseSingleDayPlanning(resolved: ResolvedIntent): ResolvedIntent {
  if (resolved.intent !== "planning") return resolved;
  const dayCount = resolved.range?.dayCount ?? (hasMultiDayMarker(resolved.text) ? 2 : 1);
  return dayCount > 1 ? resolved : { ...resolved, intent: "outfit_request" };
}

/** The window a multi-day handler should actually cover. */
export function resolvePlanWindow(
  resolved: ResolvedIntent,
  baseDate: string,
  fallbackDays: number,
): IntentDateRange {
  return (
    resolved.range ?? buildIntentRange(baseDate, fallbackDays, `the next ${fallbackDays} days`)
  );
}

export const ESCALATION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Runs immediately before the one classifier model call, and only then. The
 * authenticated chat boundary passes its rolling-limit check here so routing
 * escalation is rate-limited without charging a generation budget.
 */
export type IntentEscalationGate = () => Promise<unknown>;

/** Slots are always deterministic: only the intent label can come from a model. */
function buildSlots(request: string, baseDate: string) {
  const text = request.toLowerCase();
  const { focus, unwornSince } = resolveInsightSlots(text, baseDate);
  return {
    text,
    range: resolveRequestDateRange(text, baseDate),
    destination: extractTripDestination(request),
    insightFocus: focus,
    unwornSince,
    itemQuery: buildItemQuery(request),
  };
}

export function resolveWardrobeIntentDeterministic(
  request: string,
  baseDate: string,
): ResolvedIntent {
  const slots = buildSlots(request, baseDate);
  const deterministic = classifyWardrobeIntentDetailed(request);
  return collapseSingleDayPlanning({ ...slots, ...deterministic, source: "rules" });
}

/**
 * Keyword rules decide confident requests for free; only genuinely ambiguous
 * text costs one small structured model call, and a failed or unconfigured
 * call keeps the deterministic route.
 */
export async function resolveWardrobeIntent(
  input: { request: string; date: string; userId: string },
  gate?: IntentEscalationGate,
): Promise<ResolvedIntent> {
  const resolved = resolveWardrobeIntentDeterministic(input.request, input.date);
  if (resolved.confidence >= ESCALATION_CONFIDENCE_THRESHOLD) return resolved;
  if (!canClassifyWardrobeIntentWithModel()) return resolved;

  if (gate) await gate();
  const escalated = await classifyWardrobeIntentWithModel(input.request, input.userId);
  return escalated
    ? collapseSingleDayPlanning({ ...resolved, ...escalated, source: "model" })
    : resolved;
}
