import type { WardrobeItem } from "@/features/wardrobe/types";

import { normalizeTag, normalizedTags } from "./filters-tags";
import type { HardFilterContext, HardFilterReason } from "./filters.types";

export function dressRuleReasons(
  item: WardrobeItem,
  context: HardFilterContext,
): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];

  if (
    context.minimumFormality !== undefined &&
    item.formality_level !== null &&
    item.formality_level < context.minimumFormality
  ) {
    reasons.push({ code: "dress_rule", message: "The item is below the required formality." });
  }
  if (
    context.maximumFormality !== undefined &&
    item.formality_level !== null &&
    item.formality_level > context.maximumFormality
  ) {
    reasons.push({ code: "dress_rule", message: "The item exceeds the allowed formality." });
  }

  const itemTags = normalizedTags(item);
  const forbiddenTags = (context.forbiddenTags ?? []).map(normalizeTag);
  if (forbiddenTags.some((tag) => itemTags.has(tag))) {
    reasons.push({ code: "dress_rule", message: "The item conflicts with a dress rule." });
  }

  const requiredTags = (context.requiredOccasionTags ?? []).map(normalizeTag);
  const occasionTags = new Set(item.occasion_tags.map(normalizeTag));
  if (
    requiredTags.length > 0 &&
    occasionTags.size > 0 &&
    !requiredTags.some((tag) => occasionTags.has(tag))
  ) {
    reasons.push({ code: "dress_rule", message: "The item is tagged for a different occasion." });
  }

  return reasons;
}
