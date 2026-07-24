import type { OccasionCategory } from "./constants.data";
import type { CategoryProfile } from "./types";

// Checked in this order: more specific occasions are matched before the
// generic ones they could otherwise be absorbed by (e.g. "job interview"
// must resolve to "interview", not "work").
export const CATEGORY_PROFILES: Record<Exclude<OccasionCategory, "casual">, CategoryProfile> = {
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

export const CASUAL_PROFILE: CategoryProfile = {
  targetFormality: 1,
  indoorOutdoor: "mixed",
  activityLevel: "moderate",
  pattern: /\bcasual\b|weekend|hang(ing)? out/i,
  occasionTags: ["casual"],
};

export const CATEGORY_PRIORITY: readonly Exclude<OccasionCategory, "casual">[] = [
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

// Casual last: it's the catch-all, checked only after every more specific
// category has had a chance to match.
export const ALL_CATEGORY_PROFILES: readonly (readonly [OccasionCategory, CategoryProfile])[] = [
  ...CATEGORY_PRIORITY.map((category) => [category, CATEGORY_PROFILES[category]] as const),
  ["casual", CASUAL_PROFILE] as const,
];
