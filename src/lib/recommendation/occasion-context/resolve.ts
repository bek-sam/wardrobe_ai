import { ALL_CATEGORY_PROFILES, CASUAL_PROFILE } from "./category-profiles.data";
import type { OccasionCategory, TimeOfDay } from "./constants.data";
import { detectDressCodeConstraints } from "./dress-code";
import { detectTimeOfDay } from "./time-of-day";
import type { CategoryProfile, OccasionContext } from "./types";
import { deriveUnresolvedQuestions } from "./unresolved-questions";

function buildContext(
  category: OccasionCategory,
  profile: Pick<CategoryProfile, "targetFormality" | "indoorOutdoor" | "activityLevel">,
  timeOfDay: TimeOfDay,
  dressCodeConstraints: string[],
  confidence: number,
  matchedKeywords: string[],
): OccasionContext {
  return {
    category,
    targetFormality: profile.targetFormality,
    indoorOutdoor: profile.indoorOutdoor,
    activityLevel: profile.activityLevel,
    timeOfDay,
    dressCodeConstraints,
    confidence,
    matchedKeywords,
    unresolvedQuestions: deriveUnresolvedQuestions(
      profile.targetFormality,
      confidence,
      dressCodeConstraints,
    ),
  };
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

  if (text) {
    for (const [category, profile] of ALL_CATEGORY_PROFILES) {
      const match = text.match(profile.pattern);
      if (match) {
        return buildContext(category, profile, timeOfDay, dressCodeConstraints, 0.8, [match[0]]);
      }
    }
  }

  const confidence = text ? 0.2 : 0;
  return buildContext("casual", CASUAL_PROFILE, timeOfDay, dressCodeConstraints, confidence, []);
}
