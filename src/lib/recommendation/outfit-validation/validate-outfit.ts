import { generatedOutfitSchema } from "@/features/outfits/schemas";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { outfitCombinationKey } from "../planner";
import { resolveOutfitItems } from "./resolve-items";
import type { OutfitValidationOptions, OutfitValidationResult } from "./types";

export function validateGeneratedOutfit(
  value: unknown,
  suppliedCandidates: readonly WardrobeItem[],
  options: OutfitValidationOptions = {},
): OutfitValidationResult {
  const parsed = generatedOutfitSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      code: "schema" as const,
      message: issue.message,
      path: issue.path,
    }));
    return { success: false, outfit: null, issues };
  }

  const candidates = new Map(suppliedCandidates.map((item) => [item.id, item]));
  const allowedAvailability = new Set(options.allowedAvailabilityStatuses ?? ["available"]);
  const { issues, resolvedItems } = resolveOutfitItems(
    parsed.data.items,
    candidates,
    options,
    allowedAvailability,
  );
  if (issues.length > 0) return { success: false, outfit: null, issues };

  return {
    success: true,
    issues: [],
    outfit: {
      ...parsed.data,
      resolvedItems,
      combinationKey: outfitCombinationKey(parsed.data.items.map((item) => item.item_id)),
    },
  };
}
