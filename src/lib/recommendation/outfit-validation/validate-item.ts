import type { GeneratedOutfit } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { resolveWardrobeItemRole } from "../item-role";
import type { OutfitValidationIssue, OutfitValidationOptions } from "./types";

export function validateOutfitItem(
  item: WardrobeItem,
  selection: GeneratedOutfit["items"][number],
  options: OutfitValidationOptions,
  allowedAvailability: ReadonlySet<string>,
): OutfitValidationIssue[] {
  const issues: OutfitValidationIssue[] = [];

  if (options.expectedUserId && item.user_id !== options.expectedUserId) {
    issues.push({
      code: "wrong_owner",
      itemId: item.id,
      message: "The selected item does not belong to the authenticated user.",
    });
  }
  if (item.status !== "active" || item.deleted_at !== null) {
    issues.push({ code: "inactive", itemId: item.id, message: "The selected item is not active." });
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

  return issues;
}
