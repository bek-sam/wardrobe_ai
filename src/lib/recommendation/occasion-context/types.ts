import type { ActivityLevel, IndoorOutdoor, OccasionCategory, TimeOfDay } from "./constants.data";

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

export interface CategoryProfile {
  targetFormality: number;
  indoorOutdoor: IndoorOutdoor;
  activityLevel: ActivityLevel;
  pattern: RegExp;
  occasionTags: readonly string[];
}
