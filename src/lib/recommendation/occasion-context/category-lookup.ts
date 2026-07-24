import { CASUAL_PROFILE, CATEGORY_PROFILES } from "./category-profiles.data";
import type { OccasionCategory } from "./constants.data";
import type { CategoryProfile, OccasionContext } from "./types";

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

// A regex-matched occasion category is only trustworthy enough to hard-filter
// or score against once its confidence clears this bar; below it, callers
// should treat the request as occasion-agnostic rather than risk excluding
// items on a low-confidence guess.
export const OCCASION_CATEGORY_CONFIDENT_THRESHOLD = 0.5;

export function confidentOccasionTags(
  context: Pick<OccasionContext, "category" | "confidence">,
): readonly string[] | undefined {
  return context.confidence >= OCCASION_CATEGORY_CONFIDENT_THRESHOLD
    ? occasionCategoryTags(context.category)
    : undefined;
}
