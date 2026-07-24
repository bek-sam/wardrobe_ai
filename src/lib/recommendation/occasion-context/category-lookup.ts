import { CASUAL_PROFILE, CATEGORY_PROFILES } from "./category-profiles.data";
import type { OccasionCategory } from "./constants.data";
import type { CategoryProfile } from "./types";

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
