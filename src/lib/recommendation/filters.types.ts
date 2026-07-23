import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";
import type { ClothingConstraints } from "@/lib/weather";

export type HardFilterReasonCode =
  "inactive" | "deleted" | "unavailable" | "dress_rule" | "weather" | "image_required";

export interface HardFilterReason {
  code: HardFilterReasonCode;
  message: string;
}

export interface HardFilterContext {
  allowedAvailabilityStatuses?: readonly AvailabilityStatus[];
  requiredOccasionTags?: readonly string[];
  forbiddenTags?: readonly string[];
  minimumFormality?: number;
  maximumFormality?: number;
  weather?: ClothingConstraints;
  requireImage?: boolean;
  itemIdsWithImages?: ReadonlySet<string> | readonly string[];
}

export interface ExcludedWardrobeItem {
  item: WardrobeItem;
  reasons: HardFilterReason[];
}

export interface HardFilterResult {
  eligible: WardrobeItem[];
  excluded: ExcludedWardrobeItem[];
}
