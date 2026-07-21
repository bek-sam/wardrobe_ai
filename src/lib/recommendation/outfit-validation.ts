import { generatedOutfitSchema } from "@/features/outfits/schemas";
import type { GeneratedOutfit, OutfitItemRole } from "@/features/outfits/types";
import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";

import { outfitCombinationKey } from "./planner";
import { resolveWardrobeItemRole } from "./item-role";

export type OutfitValidationIssueCode =
  | "schema"
  | "unknown_item"
  | "wrong_owner"
  | "inactive"
  | "unavailable"
  | "unknown_role"
  | "role_mismatch";

export interface OutfitValidationIssue {
  code: OutfitValidationIssueCode;
  message: string;
  itemId?: string;
  path?: PropertyKey[];
}

export interface OutfitValidationOptions {
  expectedUserId?: string;
  allowedAvailabilityStatuses?: readonly AvailabilityStatus[];
}

export interface ValidatedOutfit extends GeneratedOutfit {
  resolvedItems: WardrobeItem[];
  combinationKey: string;
}

export type OutfitValidationResult =
  | { success: true; outfit: ValidatedOutfit; issues: [] }
  | { success: false; outfit: null; issues: OutfitValidationIssue[] };

export function validateGeneratedOutfit(
  value: unknown,
  suppliedCandidates: readonly WardrobeItem[],
  options: OutfitValidationOptions = {},
): OutfitValidationResult {
  const parsed = generatedOutfitSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      outfit: null,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema" as const,
        message: issue.message,
        path: issue.path,
      })),
    };
  }

  const candidates = new Map(suppliedCandidates.map((item) => [item.id, item]));
  const allowedAvailability = new Set(options.allowedAvailabilityStatuses ?? ["available"]);
  const issues: OutfitValidationIssue[] = [];
  const resolvedItems: WardrobeItem[] = [];

  for (const selection of parsed.data.items) {
    const item = candidates.get(selection.item_id);
    if (!item) {
      issues.push({
        code: "unknown_item",
        itemId: selection.item_id,
        message: "The outfit selected an item outside the supplied owned-item candidates.",
      });
      continue;
    }

    if (options.expectedUserId && item.user_id !== options.expectedUserId) {
      issues.push({
        code: "wrong_owner",
        itemId: item.id,
        message: "The selected item does not belong to the authenticated user.",
      });
    }
    if (item.status !== "active" || item.deleted_at !== null) {
      issues.push({
        code: "inactive",
        itemId: item.id,
        message: "The selected item is not active.",
      });
    }
    if (!allowedAvailability.has(item.availability_status)) {
      issues.push({
        code: "unavailable",
        itemId: item.id,
        message: `The selected item is currently ${item.availability_status}.`,
      });
    }

    const actualRole = resolveWardrobeItemRole(item);
    if (!actualRole) {
      issues.push({
        code: "unknown_role",
        itemId: item.id,
        message: "The selected item's wardrobe role is unknown.",
      });
    } else if (actualRole !== selection.role) {
      issues.push({
        code: "role_mismatch",
        itemId: item.id,
        message: `The item is a ${actualRole}, not a ${selection.role}.`,
      });
    }

    resolvedItems.push(item);
  }

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

export function requiredRoleIsPresent(outfit: GeneratedOutfit, role: OutfitItemRole) {
  return outfit.items.some((item) => item.role === role);
}
