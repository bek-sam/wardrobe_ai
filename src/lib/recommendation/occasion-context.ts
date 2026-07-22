export const OCCASION_CATEGORIES = [
  "casual",
  "work",
  "business",
  "interview",
  "dinner",
  "date",
  "wedding",
  "formal_event",
  "party",
  "concert",
  "travel",
  "outdoor",
  "exercise",
  "errands",
] as const;

export type OccasionCategory = (typeof OCCASION_CATEGORIES)[number];
export const INDOOR_OUTDOOR_VALUES = ["indoor", "outdoor", "mixed"] as const;
export type IndoorOutdoor = (typeof INDOOR_OUTDOOR_VALUES)[number];
export const ACTIVITY_LEVELS = ["low", "moderate", "high"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export const TIMES_OF_DAY = ["morning", "afternoon", "evening", "night", "unspecified"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface OccasionContext {
  category: OccasionCategory;
  targetFormality: number;
  indoorOutdoor: IndoorOutdoor;
  activityLevel: ActivityLevel;
  timeOfDay: TimeOfDay;
  dressCodeConstraints: string[];
  confidence: number;
  matchedKeywords: string[];
  unresolvedQuestions: string[];
}

interface CategoryProfile {
  targetFormality: number;
  indoorOutdoor: IndoorOutdoor;
  activityLevel: ActivityLevel;
  pattern: RegExp;
  occasionTags: readonly string[];
}

// Checked in this order: more specific occasions are matched before the
// generic ones they could otherwise be absorbed by (e.g. "job interview"
// must resolve to "interview", not "work").
const CATEGORY_PROFILES: Record<Exclude<OccasionCategory, "casual">, CategoryProfile> = {
  interview: {
    targetFormality: 4,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\binterview/i,
    occasionTags: ["interview", "business"],
  },
  wedding: {
    targetFormality: 4,
    indoorOutdoor: "mixed",
    activityLevel: "low",
    pattern: /\bwedding|bridal|bridesmaid|groomsman/i,
    occasionTags: ["wedding"],
  },
  formal_event: {
    targetFormality: 5,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\bgala|black[\s-]?tie|red carpet|awards? (show|ceremony)|formal event/i,
    occasionTags: ["formal", "event", "black tie"],
  },
  business: {
    targetFormality: 4,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /business (meeting|trip|dinner|event)|client meeting|boardroom|conference|corporate/i,
    occasionTags: ["business", "work"],
  },
  work: {
    targetFormality: 2,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\bwork\b|\boffice\b|workday|\bmeeting\b/i,
    occasionTags: ["work"],
  },
  dinner: {
    targetFormality: 3,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\bdinner\b|\brestaurant\b/i,
    occasionTags: ["dinner"],
  },
  date: {
    targetFormality: 3,
    indoorOutdoor: "mixed",
    activityLevel: "low",
    pattern: /\bdate\b|date night/i,
    occasionTags: ["date", "date night"],
  },
  party: {
    targetFormality: 3,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\bparty\b|birthday|celebration|\bclub\b|dancing/i,
    occasionTags: ["party"],
  },
  concert: {
    targetFormality: 2,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\bconcert\b|festival|\bgig\b|\bshow\b/i,
    occasionTags: ["concert"],
  },
  travel: {
    targetFormality: 2,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\btravel\b|\btrip\b|flight|airport|vacation|packing/i,
    occasionTags: ["travel"],
  },
  outdoor: {
    targetFormality: 1,
    indoorOutdoor: "outdoor",
    activityLevel: "high",
    pattern: /\bhike|hiking|camping|\boutdoor|\bpark\b|picnic/i,
    occasionTags: ["outdoor"],
  },
  exercise: {
    targetFormality: 1,
    indoorOutdoor: "mixed",
    activityLevel: "high",
    pattern: /\bgym\b|workout|\bexercise\b|\brun\b|running|yoga|pilates|training/i,
    occasionTags: ["exercise", "workout"],
  },
  errands: {
    targetFormality: 1,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\berrands?\b|grocery|groceries|\bchores\b|laundromat/i,
    occasionTags: ["errands"],
  },
};

const CASUAL_PROFILE: CategoryProfile = {
  targetFormality: 1,
  indoorOutdoor: "mixed",
  activityLevel: "moderate",
  pattern: /\bcasual\b|weekend|hang(ing)? out/i,
  occasionTags: ["casual"],
};

const CATEGORY_PRIORITY: readonly Exclude<OccasionCategory, "casual">[] = [
  "interview",
  "wedding",
  "formal_event",
  "business",
  "work",
  "dinner",
  "date",
  "party",
  "concert",
  "travel",
  "outdoor",
  "exercise",
  "errands",
];

export function occasionCategoryTags(category: OccasionCategory): readonly string[] {
  return category === "casual"
    ? CASUAL_PROFILE.occasionTags
    : CATEGORY_PROFILES[category].occasionTags;
}

export function occasionCategoryProfile(
  category: OccasionCategory,
): Pick<CategoryProfile, "targetFormality" | "indoorOutdoor" | "activityLevel"> {
  return category === "casual" ? CASUAL_PROFILE : CATEGORY_PROFILES[category];
}

// Checked independently of occasion category: time cues ("dinner tonight" vs
// "dinner tomorrow morning") don't reliably correlate with which occasion
// category matched, so these are detected directly from the raw text.
const TIME_OF_DAY_PATTERNS: readonly [TimeOfDay, RegExp][] = [
  ["morning", /\bmorning\b|\bbreakfast\b|\bbrunch\b/i],
  ["afternoon", /\bafternoon\b|\blunch\b|\bmidday\b/i],
  ["evening", /\bevening\b|\bdinner\b|\btonight\b|\bafter work\b/i],
  ["night", /\bnight\b|\blate[\s-]?night\b/i],
];

function detectTimeOfDay(text: string): TimeOfDay {
  for (const [timeOfDay, pattern] of TIME_OF_DAY_PATTERNS) {
    if (pattern.test(text)) return timeOfDay;
  }
  return "unspecified";
}

// Explicit dress-code phrasing, captured verbatim (not mapped onto the fixed
// occasion categories) so a stricter constraint than the category's default
// formality is never silently dropped.
const DRESS_CODE_PATTERNS: readonly RegExp[] = [
  /black[\s-]?tie(?:\s+optional)?/i,
  /white[\s-]?tie/i,
  /cocktail attire/i,
  /business casual/i,
  /smart casual/i,
  /no jeans/i,
  /all[\s-]?white/i,
  /all[\s-]?black/i,
  /formal attire/i,
  /costume|themed/i,
];

function detectDressCodeConstraints(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of DRESS_CODE_PATTERNS) {
    const match = text.match(pattern);
    if (match) matches.push(match[0].toLowerCase());
  }
  return matches;
}

// Surfaces what the deterministic pass couldn't pin down, so a caller (or an
// AI escalation layered on top) knows what's still worth asking about instead
// of silently guessing. Regex category matches are always exactly 0.8
// confidence, so the dress-code question is gated on formality (a black-tie-
// caliber event is worth confirming even when the category match itself is
// confident), not on confidence a second time.
function deriveUnresolvedQuestions(
  targetFormality: number,
  confidence: number,
  dressCodeConstraints: readonly string[],
): string[] {
  const questions: string[] = [];
  if (confidence < 0.5) {
    questions.push("What's the occasion, and how dressy should it feel?");
  }
  if (targetFormality >= 4 && dressCodeConstraints.length === 0) {
    questions.push("Is there a specific dress code to follow?");
  }
  return questions;
}

/**
 * Deterministic occasion-context resolver: maps free-form user/request text
 * (never trusted as an exact database tag) onto a fixed set of normalized
 * categories with a target formality, setting, activity level, time of day,
 * any explicit dress-code phrasing, and a confidence score. Unmatched or
 * empty text resolves to "casual" with low confidence rather than failing,
 * since a safe default outfit is still useful; resolveOccasionContextWithEscalation()
 * (lib/ai/agents/occasion-agent.ts) layers structured AI on top of this same
 * return shape for the low-confidence case, without changing this function.
 */
export function resolveOccasionContext(rawText?: string | null): OccasionContext {
  const text = (rawText ?? "").toLowerCase().trim();
  const timeOfDay = detectTimeOfDay(text);
  const dressCodeConstraints = detectDressCodeConstraints(text);

  if (!text) {
    return {
      category: "casual",
      ...CASUAL_PROFILE,
      timeOfDay,
      dressCodeConstraints,
      confidence: 0,
      matchedKeywords: [],
      unresolvedQuestions: deriveUnresolvedQuestions(
        CASUAL_PROFILE.targetFormality,
        0,
        dressCodeConstraints,
      ),
    };
  }

  for (const category of CATEGORY_PRIORITY) {
    const profile = CATEGORY_PROFILES[category];
    const match = text.match(profile.pattern);
    if (match) {
      const confidence = 0.8;
      return {
        category,
        targetFormality: profile.targetFormality,
        indoorOutdoor: profile.indoorOutdoor,
        activityLevel: profile.activityLevel,
        timeOfDay,
        dressCodeConstraints,
        confidence,
        matchedKeywords: [match[0]],
        unresolvedQuestions: deriveUnresolvedQuestions(
          profile.targetFormality,
          confidence,
          dressCodeConstraints,
        ),
      };
    }
  }

  if (CASUAL_PROFILE.pattern.test(text)) {
    const confidence = 0.8;
    return {
      category: "casual",
      ...CASUAL_PROFILE,
      timeOfDay,
      dressCodeConstraints,
      confidence,
      matchedKeywords: [text.match(CASUAL_PROFILE.pattern)?.[0] ?? "casual"],
      unresolvedQuestions: deriveUnresolvedQuestions(
        CASUAL_PROFILE.targetFormality,
        confidence,
        dressCodeConstraints,
      ),
    };
  }

  const confidence = 0.2;
  return {
    category: "casual",
    ...CASUAL_PROFILE,
    timeOfDay,
    dressCodeConstraints,
    confidence,
    matchedKeywords: [],
    unresolvedQuestions: deriveUnresolvedQuestions(
      CASUAL_PROFILE.targetFormality,
      confidence,
      dressCodeConstraints,
    ),
  };
}
