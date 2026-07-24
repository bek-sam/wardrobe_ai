import type { OccasionCategory } from "@/lib/recommendation";

import { PROFILES } from "./profiles.data";
import type { OccasionStyleProfile } from "./types";

export function occasionStyleProfile(category: OccasionCategory): OccasionStyleProfile {
  return PROFILES[category];
}
