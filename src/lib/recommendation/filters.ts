import type { WardrobeItem } from "@/features/wardrobe/types";

import { dressRuleReasons } from "./filters-dress-rules";
import { imageRequiredReasons } from "./filters-image";
import { statusReasons } from "./filters-status";
import { weatherReasons } from "./filters-weather";
import type {
  ExcludedWardrobeItem,
  HardFilterContext,
  HardFilterReason,
  HardFilterResult,
} from "./filters.types";
import { resolveWardrobeItemRole } from "./item-role";

export function getHardFilterReasons(
  item: WardrobeItem,
  context: HardFilterContext = {},
): HardFilterReason[] {
  const reasons: HardFilterReason[] = [
    ...statusReasons(item, context),
    ...dressRuleReasons(item, context),
  ];

  if (context.weather) {
    reasons.push(...weatherReasons(item, resolveWardrobeItemRole(item), context.weather));
  }
  reasons.push(...imageRequiredReasons(item, context));

  return reasons;
}

export function filterWardrobeCandidates(
  items: readonly WardrobeItem[],
  context: HardFilterContext = {},
): HardFilterResult {
  const eligible: WardrobeItem[] = [];
  const excluded: ExcludedWardrobeItem[] = [];

  for (const item of items) {
    const reasons = getHardFilterReasons(item, context);
    if (reasons.length === 0) eligible.push(item);
    else excluded.push({ item, reasons });
  }

  return { eligible, excluded };
}
