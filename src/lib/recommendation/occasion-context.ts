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
export type IndoorOutdoor = "indoor" | "outdoor" | "mixed";
export type ActivityLevel = "low" | "moderate" | "high";

export interface OccasionContext {
  category: OccasionCategory;
  targetFormality: number;
  indoorOutdoor: IndoorOutdoor;
  activityLevel: ActivityLevel;
  confidence: number;
  matchedKeywords: string[];
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

/**
 * Deterministic occasion-context resolver: maps free-form user/request text
 * (never trusted as an exact database tag) onto a fixed set of normalized
 * categories with a target formality, setting, activity level, and a
 * confidence score. Unmatched or empty text resolves to "casual" with low
 * confidence rather than failing, since a safe default outfit is still
 * useful. An AI fallback for genuinely ambiguous text can be layered on top
 * of this same return shape later without changing any caller.
 */
export function resolveOccasionContext(rawText?: string | null): OccasionContext {
  const text = (rawText ?? "").toLowerCase().trim();
  if (!text) {
    return {
      category: "casual",
      ...CASUAL_PROFILE,
      confidence: 0,
      matchedKeywords: [],
    };
  }

  for (const category of CATEGORY_PRIORITY) {
    const profile = CATEGORY_PROFILES[category];
    const match = text.match(profile.pattern);
    if (match) {
      return {
        category,
        targetFormality: profile.targetFormality,
        indoorOutdoor: profile.indoorOutdoor,
        activityLevel: profile.activityLevel,
        confidence: 0.8,
        matchedKeywords: [match[0]],
      };
    }
  }

  if (CASUAL_PROFILE.pattern.test(text)) {
    return {
      category: "casual",
      ...CASUAL_PROFILE,
      confidence: 0.8,
      matchedKeywords: [text.match(CASUAL_PROFILE.pattern)?.[0] ?? "casual"],
    };
  }

  return {
    category: "casual",
    ...CASUAL_PROFILE,
    confidence: 0.2,
    matchedKeywords: [],
  };
}
