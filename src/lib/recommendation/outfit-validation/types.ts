import type { GeneratedOutfit } from "@/features/outfits/types";
import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";

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
