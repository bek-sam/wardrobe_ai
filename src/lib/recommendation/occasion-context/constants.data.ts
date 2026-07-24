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
