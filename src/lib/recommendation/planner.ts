import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";

import { resolveWardrobeItemRole } from "./item-role";

function isCandidateArray(
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
): candidates is readonly WardrobeItem[] {
  return Array.isArray(candidates);
}

function asCandidateMap(
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
): ReadonlyMap<string, WardrobeItem> {
  return isCandidateArray(candidates)
    ? new Map(candidates.map((item) => [item.id, item]))
    : candidates;
}

export function outfitCombinationKey(itemIds: readonly string[]) {
  return [...new Set(itemIds)].sort().join(":");
}

export function outfitFoundationKey(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
) {
  const candidateMap = asCandidateMap(candidates);
  const topIds: string[] = [];
  const bottomIds: string[] = [];
  const dressIds: string[] = [];

  for (const itemId of itemIds) {
    const item = candidateMap.get(itemId);
    if (!item) continue;
    const role = resolveWardrobeItemRole(item);
    if (role === "top") topIds.push(itemId);
    if (role === "bottom") bottomIds.push(itemId);
    if (role === "dress") dressIds.push(itemId);
  }

  if (dressIds.length === 1 && topIds.length === 0 && bottomIds.length === 0) {
    return `dress:${dressIds[0]}`;
  }
  if (topIds.length !== 1 || bottomIds.length !== 1) return null;
  return `${topIds[0]}:${bottomIds[0]}`;
}

export function hasCompleteOutfitStructure(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
) {
  if (itemIds.length < 1 || itemIds.length > 5 || new Set(itemIds).size !== itemIds.length) {
    return false;
  }

  const candidateMap = asCandidateMap(candidates);
  const roleCounts = new Map<string, number>();
  for (const itemId of itemIds) {
    const item = candidateMap.get(itemId);
    if (!item) return false;
    const role = resolveWardrobeItemRole(item);
    if (!role) return false;
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  const dressCount = roleCounts.get("dress") ?? 0;
  const topCount = roleCounts.get("top") ?? 0;
  const bottomCount = roleCounts.get("bottom") ?? 0;
  const hasOnePieceFoundation = dressCount === 1 && topCount === 0 && bottomCount === 0;
  const hasTwoPieceFoundation = dressCount === 0 && topCount === 1 && bottomCount === 1;
  if (!hasOnePieceFoundation && !hasTwoPieceFoundation) return false;
  return ["layer", "shoes", "accessory"].every((role) => (roleCounts.get(role) ?? 0) <= 1);
}

export function getUnavailableItemIds(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
  allowedAvailabilityStatuses: readonly AvailabilityStatus[] = ["available"],
) {
  const candidateMap = asCandidateMap(candidates);
  const allowed = new Set(allowedAvailabilityStatuses);

  return itemIds.filter((itemId) => {
    const item = candidateMap.get(itemId);
    return (
      !item ||
      item.status !== "active" ||
      item.deleted_at !== null ||
      !allowed.has(item.availability_status)
    );
  });
}

export function isOutfitAvailable(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
  allowedAvailabilityStatuses: readonly AvailabilityStatus[] = ["available"],
) {
  return getUnavailableItemIds(itemIds, candidates, allowedAvailabilityStatuses).length === 0;
}

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

function proposalTieBreak(first: OutfitPlanProposal, second: OutfitPlanProposal) {
  return first.id.localeCompare(second.id);
}

export function selectBalancedOutfitPlans(
  proposals: readonly OutfitPlanProposal[],
  candidates: readonly WardrobeItem[],
  options: BalancedPlannerOptions,
): BalancedPlannerResult {
  const count = Math.max(0, Math.floor(options.count));
  const requestedFoundationRepeats = options.maximumFoundationRepeats ?? 1;
  if (!Number.isFinite(requestedFoundationRepeats)) {
    throw new Error("maximumFoundationRepeats must be a finite number.");
  }
  const maximumFoundationRepeats = Math.max(1, Math.floor(requestedFoundationRepeats));
  const candidateMap = new Map(candidates.map((item) => [item.id, item]));
  const existingKeys = new Set(
    options.existingCombinationKeys instanceof Set
      ? options.existingCombinationKeys
      : (options.existingCombinationKeys ?? []),
  );
  const rejected: PlannerRejection[] = [];

  const bestByCombination = new Map<string, OutfitPlanProposal>();
  for (const proposal of proposals) {
    const key = outfitCombinationKey(proposal.item_ids);
    if (existingKeys.has(key)) {
      rejected.push({ proposal, reason: "duplicate_combination" });
      continue;
    }
    if (
      !isOutfitAvailable(
        proposal.item_ids,
        candidateMap,
        options.allowedAvailabilityStatuses ?? ["available"],
      )
    ) {
      rejected.push({ proposal, reason: "unavailable_item" });
      continue;
    }
    if (!outfitFoundationKey(proposal.item_ids, candidateMap)) {
      rejected.push({ proposal, reason: "invalid_foundation" });
      continue;
    }
    if (!hasCompleteOutfitStructure(proposal.item_ids, candidateMap)) {
      rejected.push({ proposal, reason: "invalid_structure" });
      continue;
    }

    const existing = bestByCombination.get(key);
    if (
      !existing ||
      proposal.base_score > existing.base_score ||
      (proposal.base_score === existing.base_score && proposalTieBreak(proposal, existing) < 0)
    ) {
      if (existing) rejected.push({ proposal: existing, reason: "duplicate_combination" });
      bestByCombination.set(key, proposal);
    } else {
      rejected.push({ proposal, reason: "duplicate_combination" });
    }
  }

  const remaining = [...bestByCombination.values()];
  const selected: OutfitPlanProposal[] = [];
  const selectedUsage = new Map<string, number>();
  const foundationUsage = new Map<string, number>();

  while (selected.length < count && remaining.length > 0) {
    const eligible = remaining.filter((proposal) => {
      const foundation = outfitFoundationKey(proposal.item_ids, candidateMap);
      return (
        foundation !== null && (foundationUsage.get(foundation) ?? 0) < maximumFoundationRepeats
      );
    });
    if (eligible.length === 0) break;

    eligible.sort((first, second) => {
      const adjustedScore = (proposal: OutfitPlanProposal) => {
        const penalties = proposal.item_ids.map((itemId) => {
          const historicalWear = Math.min(candidateMap.get(itemId)?.wear_count ?? 0, 25) / 25;
          const plannedUse = selectedUsage.get(itemId) ?? 0;
          return historicalWear * 0.08 + plannedUse * 0.14;
        });
        const usagePenalty =
          penalties.reduce((total, penalty) => total + penalty, 0) / penalties.length;
        return proposal.base_score - usagePenalty;
      };

      return adjustedScore(second) - adjustedScore(first) || proposalTieBreak(first, second);
    });

    const next = eligible[0];
    if (!next) break;
    selected.push(next);
    for (const itemId of next.item_ids) {
      selectedUsage.set(itemId, (selectedUsage.get(itemId) ?? 0) + 1);
    }
    const foundation = outfitFoundationKey(next.item_ids, candidateMap);
    if (foundation) foundationUsage.set(foundation, (foundationUsage.get(foundation) ?? 0) + 1);
    remaining.splice(remaining.indexOf(next), 1);
  }

  for (const proposal of remaining) {
    const foundation = outfitFoundationKey(proposal.item_ids, candidateMap);
    if (foundation && (foundationUsage.get(foundation) ?? 0) >= maximumFoundationRepeats) {
      rejected.push({ proposal, reason: "foundation_repeat_limit" });
    }
  }

  return { selected, rejected, usageCounts: selectedUsage };
}
