import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { AvailabilityStatus } from "@/features/wardrobe/types";

export interface BalancedPlannerOptions {
  count: number;
  allowedAvailabilityStatuses?: readonly AvailabilityStatus[];
  existingCombinationKeys?: ReadonlySet<string> | readonly string[];
  maximumFoundationRepeats?: number;
}

export type PlannerRejectionReason =
  | "duplicate_combination"
  | "unavailable_item"
  | "invalid_foundation"
  | "invalid_structure"
  | "foundation_repeat_limit";

export interface PlannerRejection {
  proposal: OutfitPlanProposal;
  reason: PlannerRejectionReason;
}

export interface BalancedPlannerResult {
  selected: OutfitPlanProposal[];
  rejected: PlannerRejection[];
  usageCounts: ReadonlyMap<string, number>;
}
