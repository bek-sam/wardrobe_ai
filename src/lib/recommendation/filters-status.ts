import type { WardrobeItem } from "@/features/wardrobe/types";

import type { HardFilterContext, HardFilterReason } from "./filters.types";

export function statusReasons(item: WardrobeItem, context: HardFilterContext): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];
  if (item.status !== "active") {
    reasons.push({ code: "inactive", message: `The item status is ${item.status}.` });
  }
  if (item.deleted_at !== null) {
    reasons.push({ code: "deleted", message: "The item has been deleted." });
  }

  const allowedAvailability = new Set(context.allowedAvailabilityStatuses ?? ["available"]);
  if (!allowedAvailability.has(item.availability_status)) {
    reasons.push({
      code: "unavailable",
      message: `The item is currently ${item.availability_status}.`,
    });
  }

  return reasons;
}
