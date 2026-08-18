import type { WardrobeItem } from "@/features/wardrobe";
import type { WardrobeItemRole } from "@/features/wardrobe";
import type { AvailabilityStatus } from "@/features/wardrobe";
import type { ClothingConstraints } from "@/lib/weather";
import type { OutfitPlanProposal } from "@/features/outfits";
import { generatedOutfitSchema } from "@/features/outfits/schemas";
import type { GeneratedOutfit } from "@/features/outfits";

export type ColorRelation =
  | "unknown"
  | "neutral"
  | "tonal"
  | "analogous"
  | "complementary"
  | "triadic"
  | "controlled_contrast";

export interface ColorCompatibility {
  score: number;
  relation: ColorRelation;
  hueDifference: number | null;
}

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: "#111111",
  white: "#f7f7f5",
  gray: "#808080",
  grey: "#808080",
  charcoal: "#36454f",
  cream: "#fffdd0",
  ivory: "#fffff0",
  beige: "#d8c3a5",
  camel: "#c19a6b",
  brown: "#795548",
  navy: "#1b2a4a",
  blue: "#2563eb",
  teal: "#0f766e",
  green: "#2f855a",
  olive: "#708238",
  yellow: "#eab308",
  orange: "#ea580c",
  red: "#dc2626",
  burgundy: "#800020",
  pink: "#ec4899",
  purple: "#7e22ce",
};

function parseHexColor(value: string): [number, number, number] | null {
  const normalized = value.trim().toLowerCase();
  const expanded = /^#[0-9a-f]{3}$/.test(normalized)
    ? `#${normalized
        .slice(1)
        .split("")
        .map((character) => character.repeat(2))
        .join("")}`
    : normalized;
  if (!/^#[0-9a-f]{6}$/.test(expanded)) return null;
  return [
    Number.parseInt(expanded.slice(1, 3), 16),
    Number.parseInt(expanded.slice(3, 5), 16),
    Number.parseInt(expanded.slice(5, 7), 16),
  ];
}

function rgbToHsl([redByte, greenByte, blueByte]: [number, number, number]): HslColor {
  const red = redByte / 255;
  const green = greenByte / 255;
  const blue = blueByte / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);
  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

function toHsl(color: string | null | undefined): HslColor | null {
  if (!color) return null;
  const namedHex = NAMED_COLORS[color.trim().toLowerCase()];
  const rgb = parseHexColor(namedHex ?? color);
  return rgb ? rgbToHsl(rgb) : null;
}

function isNeutral(color: HslColor) {
  return color.saturation <= 0.16 || color.lightness <= 0.08 || color.lightness >= 0.94;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function analyzeColorPair(
  firstColor: string | null | undefined,
  secondColor: string | null | undefined,
): ColorCompatibility {
  const first = toHsl(firstColor);
  const second = toHsl(secondColor);
  if (!first || !second) return { score: 0.5, relation: "unknown", hueDifference: null };
  if (isNeutral(first) || isNeutral(second)) {
    return { score: 0.92, relation: "neutral", hueDifference: null };
  }
  const rawDifference = Math.abs(first.hue - second.hue);
  const hueDifference = Math.min(rawDifference, 360 - rawDifference);
  const lightnessDifference = Math.abs(first.lightness - second.lightness);
  if (hueDifference <= 18) {
    return {
      score: clamp01(0.94 + Math.min(lightnessDifference, 0.3) * 0.1),
      relation: "tonal",
      hueDifference,
    };
  }
  if (hueDifference <= 60) return { score: 0.9, relation: "analogous", hueDifference };
  if (hueDifference >= 135) return { score: 0.86, relation: "complementary", hueDifference };
  if (hueDifference >= 100) return { score: 0.74, relation: "triadic", hueDifference };
  return { score: 0.64, relation: "controlled_contrast", hueDifference };
}

function primaryItemColor(item: Pick<WardrobeItem, "primary_color_hex" | "color_names">) {
  return item.primary_color_hex ?? item.color_names[0] ?? null;
}

export function scoreColorHarmony(
  items: readonly Pick<WardrobeItem, "primary_color_hex" | "color_names">[],
): number {
  if (items.length < 2) return items.length === 1 ? 0.75 : 0.5;
  const pairScores: number[] = [];
  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const first = items[firstIndex];
      const second = items[secondIndex];
      if (!first || !second) continue;
      pairScores.push(analyzeColorPair(primaryItemColor(first), primaryItemColor(second)).score);
    }
  }
  if (pairScores.length === 0) return 0.5;
  return pairScores.reduce((total, score) => total + score, 0) / pairScores.length;
}

const CATEGORY_ROLE_MAP: Readonly<Record<string, WardrobeItemRole>> = {
  upperbody: "top",
  top: "top",
  tops: "top",
  shirt: "top",
  shirts: "top",
  blouse: "top",
  sweater: "top",
  knitwear: "top",
  tee: "top",
  tshirt: "top",
  lowerbody: "bottom",
  bottom: "bottom",
  bottoms: "bottom",
  pants: "bottom",
  trousers: "bottom",
  jeans: "bottom",
  skirt: "bottom",
  shorts: "bottom",
  wholebody: "dress",
  dress: "dress",
  dresses: "dress",
  wholebodyup: "layer",
  layer: "layer",
  outerwear: "layer",
  jacket: "layer",
  jackets: "layer",
  coat: "layer",
  coats: "layer",
  shoes: "shoes",
  shoe: "shoes",
  footwear: "shoes",
  accessoriesup: "accessory",
  accessory: "accessory",
  accessories: "accessory",
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function resolveWardrobeItemRole(
  item: Pick<WardrobeItem, "layer_role" | "category" | "subcategory">,
): WardrobeItemRole | null {
  if (item.layer_role) return item.layer_role;

  for (const value of [item.subcategory, item.category]) {
    if (!value) continue;
    const role = CATEGORY_ROLE_MAP[normalize(value)];
    if (role) return role;
  }

  return null;
}

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

const normalizeTag = (tag: string) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

function normalizedTags(item: WardrobeItem) {
  return new Set(
    [...item.occasion_tags, ...item.weather_tags, ...item.season_tags].map(normalizeTag),
  );
}

function statusReasons(item: WardrobeItem, context: HardFilterContext): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];
  if (item.status !== "active") {
    reasons.push({ code: "inactive", message: `The item status is ${item.status}.` });
  }
  if (item.deleted_at !== null)
    reasons.push({ code: "deleted", message: "The item has been deleted." });
  const allowedAvailability = new Set(context.allowedAvailabilityStatuses ?? ["available"]);
  if (!allowedAvailability.has(item.availability_status)) {
    reasons.push({
      code: "unavailable",
      message: `The item is currently ${item.availability_status}.`,
    });
  }
  return reasons;
}

function dressRuleReasons(item: WardrobeItem, context: HardFilterContext): HardFilterReason[] {
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

function weatherReasons(
  item: WardrobeItem,
  role: WardrobeItemRole | null,
  constraints: ClothingConstraints,
): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];
  const tags = normalizedTags(item);
  if (
    item.warmth_level !== null &&
    item.warmth_level > constraints.maximumItemWarmth &&
    role !== "accessory"
  ) {
    reasons.push({ code: "weather", message: "The item is too warm for the forecast." });
  }
  if (
    constraints.rainProtectionRequired &&
    (tags.has("dry_weather_only") || (role === "shoes" && tags.has("rain_unsafe")))
  ) {
    reasons.push({ code: "weather", message: "The item is explicitly unsuitable for rain." });
  }
  if (
    constraints.snowSafeFootwearRequired &&
    role === "shoes" &&
    (tags.has("snow_unsafe") || tags.has("open_toe"))
  ) {
    reasons.push({ code: "weather", message: "The footwear is explicitly unsuitable for snow." });
  }
  if (
    constraints.effectiveMaximumC >= 24 &&
    (tags.has("cold_weather_only") || tags.has("winter_only"))
  ) {
    reasons.push({ code: "weather", message: "The item is restricted to cold weather." });
  }
  if (
    constraints.effectiveMinimumC < 5 &&
    (tags.has("hot_weather_only") || tags.has("summer_only"))
  ) {
    reasons.push({ code: "weather", message: "The item is restricted to warm weather." });
  }
  return reasons;
}

function imageRequiredReasons(item: WardrobeItem, context: HardFilterContext): HardFilterReason[] {
  if (!context.requireImage) return [];
  const imageIds =
    context.itemIdsWithImages instanceof Set
      ? context.itemIdsWithImages
      : new Set(context.itemIdsWithImages ?? []);
  return imageIds.has(item.id)
    ? []
    : [{ code: "image_required", message: "This operation requires an item image." }];
}

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

function asCandidateMap(
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
): ReadonlyMap<string, WardrobeItem> {
  return Array.isArray(candidates)
    ? new Map((candidates as readonly WardrobeItem[]).map((item) => [item.id, item]))
    : (candidates as ReadonlyMap<string, WardrobeItem>);
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
  return (
    (hasOnePieceFoundation || hasTwoPieceFoundation) &&
    ["layer", "shoes", "accessory"].every((role) => (roleCounts.get(role) ?? 0) <= 1)
  );
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

function proposalTieBreak(first: OutfitPlanProposal, second: OutfitPlanProposal) {
  return first.id.localeCompare(second.id);
}

function scoreWithoutPlannedUsage(
  proposal: OutfitPlanProposal,
  candidateMap: ReadonlyMap<string, WardrobeItem>,
) {
  let historicalPenalty = 0;
  for (const itemId of proposal.item_ids) {
    historicalPenalty += (Math.min(candidateMap.get(itemId)?.wear_count ?? 0, 25) / 25) * 0.08;
  }
  return proposal.base_score - historicalPenalty / proposal.item_ids.length;
}

function applyPlannedUsagePenalty(
  scoreWithoutPlannedUse: number,
  itemIds: readonly string[],
  selectedUsage: ReadonlyMap<string, number>,
) {
  let plannedPenalty = 0;
  for (const itemId of itemIds) plannedPenalty += (selectedUsage.get(itemId) ?? 0) * 0.14;
  return scoreWithoutPlannedUse - plannedPenalty / itemIds.length;
}

function dedupeProposals(
  proposals: readonly OutfitPlanProposal[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
  allowedAvailabilityStatuses: readonly AvailabilityStatus[],
  existingKeys: ReadonlySet<string>,
) {
  const rejected: PlannerRejection[] = [];
  const bestByCombination = new Map<string, OutfitPlanProposal>();
  for (const proposal of proposals) {
    const key = outfitCombinationKey(proposal.item_ids);
    if (existingKeys.has(key)) {
      rejected.push({ proposal, reason: "duplicate_combination" });
      continue;
    }
    if (!isOutfitAvailable(proposal.item_ids, candidateMap, allowedAvailabilityStatuses)) {
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
  return { bestByCombination, rejected };
}

function selectEligibleProposals(
  remaining: OutfitPlanProposal[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
  count: number,
  maximumFoundationRepeats: number,
) {
  const selected: OutfitPlanProposal[] = [];
  const selectedUsage = new Map<string, number>();
  const foundationUsage = new Map<string, number>();
  const selectionFacts = new Map(
    remaining.map((proposal) => [
      proposal,
      {
        foundation: outfitFoundationKey(proposal.item_ids, candidateMap),
        scoreWithoutPlannedUse: scoreWithoutPlannedUsage(proposal, candidateMap),
      },
    ]),
  );

  // Scores change after each selection, so one best-candidate scan preserves
  // greedy semantics without repeatedly sorting and allocating the full pool.
  while (selected.length < count && remaining.length > 0) {
    let nextIndex = -1;
    let nextScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const proposal = remaining[index];
      if (!proposal) continue;
      const facts = selectionFacts.get(proposal);
      const foundation = facts?.foundation ?? null;
      if (!foundation || (foundationUsage.get(foundation) ?? 0) >= maximumFoundationRepeats) {
        continue;
      }
      const score = applyPlannedUsagePenalty(
        facts?.scoreWithoutPlannedUse ?? proposal.base_score,
        proposal.item_ids,
        selectedUsage,
      );
      const currentBest = nextIndex >= 0 ? remaining[nextIndex] : undefined;
      if (
        score > nextScore ||
        (score === nextScore && currentBest && proposalTieBreak(proposal, currentBest) < 0)
      ) {
        nextIndex = index;
        nextScore = score;
      }
    }
    if (nextIndex < 0) break;
    const [next] = remaining.splice(nextIndex, 1);
    if (!next) break;
    selected.push(next);
    for (const itemId of next.item_ids) {
      selectedUsage.set(itemId, (selectedUsage.get(itemId) ?? 0) + 1);
    }
    const foundation = outfitFoundationKey(next.item_ids, candidateMap);
    if (foundation) foundationUsage.set(foundation, (foundationUsage.get(foundation) ?? 0) + 1);
  }
  return { selected, selectedUsage, foundationUsage, remaining };
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
  const { bestByCombination, rejected } = dedupeProposals(
    proposals,
    candidateMap,
    options.allowedAvailabilityStatuses ?? ["available"],
    existingKeys,
  );
  const { selected, selectedUsage, foundationUsage, remaining } = selectEligibleProposals(
    [...bestByCombination.values()],
    candidateMap,
    count,
    maximumFoundationRepeats,
  );
  for (const proposal of remaining) {
    const foundation = outfitFoundationKey(proposal.item_ids, candidateMap);
    if (foundation && (foundationUsage.get(foundation) ?? 0) >= maximumFoundationRepeats) {
      rejected.push({ proposal, reason: "foundation_repeat_limit" });
    }
  }
  return { selected, rejected, usageCounts: selectedUsage };
}

/**
 * Two looks are "meaningfully different" when they rest on a different
 * foundation (a different dress, or a different top/bottom pair) or when at
 * most half their pieces overlap. Three labels on near-identical combinations
 * is the failure mode this exists to prevent — a user who sees Safe, Fresh,
 * and Statement should be looking at three real choices.
 */
const MAX_OVERLAP_RATIO = 0.5;

export type DiversityComparable = {
  itemIds: readonly string[];
  foundationKey: string | null;
};

export function outfitOverlapRatio(first: readonly string[], second: readonly string[]): number {
  const firstSet = new Set(first);
  const shared = second.filter((itemId) => firstSet.has(itemId)).length;
  const larger = Math.max(firstSet.size, new Set(second).size);
  return larger === 0 ? 0 : shared / larger;
}

export function isMeaningfullyDifferent(
  candidate: DiversityComparable,
  chosen: DiversityComparable,
): boolean {
  if (
    candidate.foundationKey !== null &&
    chosen.foundationKey !== null &&
    candidate.foundationKey !== chosen.foundationKey
  ) {
    return true;
  }
  return outfitOverlapRatio(candidate.itemIds, chosen.itemIds) <= MAX_OVERLAP_RATIO;
}

/** True only when the candidate differs meaningfully from every prior pick. */
export function differsFromAll(
  candidate: DiversityComparable,
  chosen: readonly DiversityComparable[],
): boolean {
  return chosen.every((existing) => isMeaningfullyDifferent(candidate, existing));
}

export interface LayeringAnalysis {
  score: number;
  issues: string[];
}

type SilhouetteGroup = "fitted" | "straight" | "full" | "unknown";

function silhouetteGroup(value: string | null): SilhouetteGroup {
  const normalized = value?.toLowerCase() ?? "";
  if (/fitted|slim|tailored|clean|taper/.test(normalized)) return "fitted";
  if (/wide|full|oversize|relaxed|volume|flare|baggy/.test(normalized)) return "full";
  if (/straight|regular|classic/.test(normalized)) return "straight";
  return "unknown";
}

function isStatementPiece(item: WardrobeItem) {
  const pattern = item.pattern?.toLowerCase() ?? "";
  return pattern.length > 0 && !["solid", "plain", "none"].includes(pattern);
}

export function scoreSilhouetteCompatibility(
  top: Pick<WardrobeItem, "silhouette" | "fit">,
  bottom: Pick<WardrobeItem, "silhouette" | "fit">,
): number {
  const topGroup = silhouetteGroup(top.silhouette ?? top.fit);
  const bottomGroup = silhouetteGroup(bottom.silhouette ?? bottom.fit);
  if (topGroup === "full" && bottomGroup === "full") return 0.35;
  if (
    (topGroup === "full" && bottomGroup === "fitted") ||
    (topGroup === "fitted" && bottomGroup === "full")
  ) {
    return 0.95;
  }
  if (topGroup === "unknown" || bottomGroup === "unknown") return 0.68;
  if (topGroup === "straight" && bottomGroup === "straight") return 0.8;
  return 0.82;
}

function groupItemsByRole(items: readonly WardrobeItem[]) {
  const issues: string[] = [];
  const byRole = new Map<string, WardrobeItem[]>();
  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (!role) {
      issues.push(`Could not determine the outfit role for ${item.id}.`);
      continue;
    }
    const group = byRole.get(role) ?? [];
    group.push(item);
    byRole.set(role, group);
  }
  return { byRole, issues };
}

function scoreLayerOverTop(layer: WardrobeItem, top: WardrobeItem) {
  const issues: string[] = [];
  let scoreDelta = 0;
  const layerGroup = silhouetteGroup(layer.silhouette ?? layer.fit);
  const topGroup = silhouetteGroup(top.silhouette ?? top.fit);
  if (layerGroup === "fitted" && topGroup === "full") {
    issues.push("A fitted outer layer may not sit naturally over a full top.");
    scoreDelta -= 0.25;
  }
  if ((layer.warmth_level ?? 0) >= 4 && isStatementPiece(top) && isStatementPiece(layer)) {
    issues.push("A heavy statement layer competes with a patterned base.");
    scoreDelta -= 0.15;
  } else if ((layer.warmth_level ?? 0) >= 4 && !isStatementPiece(top)) {
    scoreDelta += 0.08;
  }
  return { scoreDelta, issues };
}

export function analyzeLayering(items: readonly WardrobeItem[]): LayeringAnalysis {
  const { byRole, issues } = groupItemsByRole(items);
  let score = 0.72;
  for (const [role, roleItems] of byRole) {
    if (roleItems.length > 1) {
      issues.push(`Multiple ${role} items make the outfit structure ambiguous.`);
      score -= 0.35;
    }
  }
  const top = byRole.get("top")?.[0];
  const bottom = byRole.get("bottom")?.[0];
  const layer = byRole.get("layer")?.[0];
  if (top && bottom) {
    const silhouetteScore = scoreSilhouetteCompatibility(top, bottom);
    score = score * 0.45 + silhouetteScore * 0.55;
    if (silhouetteScore < 0.5) issues.push("The top and bottom both carry substantial volume.");
  }
  if (layer && !top) {
    issues.push("An outer layer requires a top underneath it.");
    score -= 0.4;
  } else if (layer && top) {
    const compatibility = scoreLayerOverTop(layer, top);
    score += compatibility.scoreDelta;
    issues.push(...compatibility.issues);
  }
  const statementCount = items.filter(isStatementPiece).length;
  if (statementCount > 1) {
    issues.push("More than one patterned piece competes for attention.");
    score -= Math.min(0.2, (statementCount - 1) * 0.1);
  }
  return { score: Math.min(1, Math.max(0, score)), issues };
}

export const OCCASION_CATEGORIES = [
  "casual",
  "work",
  "business",
  "interview",
  "dinner",
  "date",
  "wedding",
  "formal_event",
  "party",
  "concert",
  "travel",
  "outdoor",
  "exercise",
  "errands",
] as const;

export type OccasionCategory = (typeof OCCASION_CATEGORIES)[number];

export const INDOOR_OUTDOOR_VALUES = ["indoor", "outdoor", "mixed"] as const;

export type IndoorOutdoor = (typeof INDOOR_OUTDOOR_VALUES)[number];

export const ACTIVITY_LEVELS = ["low", "moderate", "high"] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const TIMES_OF_DAY = ["morning", "afternoon", "evening", "night", "unspecified"] as const;

export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface OccasionContext {
  category: OccasionCategory;
  targetFormality: number;
  indoorOutdoor: IndoorOutdoor;
  activityLevel: ActivityLevel;
  timeOfDay: TimeOfDay;
  dressCodeConstraints: string[];
  confidence: number;
  matchedKeywords: string[];
  unresolvedQuestions: string[];
}

export interface CategoryProfile {
  targetFormality: number;
  indoorOutdoor: IndoorOutdoor;
  activityLevel: ActivityLevel;
  pattern: RegExp;
  occasionTags: readonly string[];
}

// Checked in this order: more specific occasions are matched before the
// generic ones they could otherwise be absorbed by (e.g. "job interview"
// must resolve to "interview", not "work").
export const CATEGORY_PROFILES: Record<Exclude<OccasionCategory, "casual">, CategoryProfile> = {
  interview: {
    targetFormality: 4,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\binterview/i,
    occasionTags: ["interview", "business"],
  },
  wedding: {
    targetFormality: 4,
    indoorOutdoor: "mixed",
    activityLevel: "low",
    pattern: /\bwedding|bridal|bridesmaid|groomsman/i,
    occasionTags: ["wedding"],
  },
  formal_event: {
    targetFormality: 5,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\bgala|black[\s-]?tie|red carpet|awards? (show|ceremony)|formal event/i,
    occasionTags: ["formal", "event", "black tie"],
  },
  business: {
    targetFormality: 4,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /business (meeting|trip|dinner|event)|client meeting|boardroom|conference|corporate/i,
    occasionTags: ["business", "work"],
  },
  work: {
    targetFormality: 2,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\bwork\b|\boffice\b|workday|\bmeeting\b/i,
    occasionTags: ["work"],
  },
  dinner: {
    targetFormality: 3,
    indoorOutdoor: "indoor",
    activityLevel: "low",
    pattern: /\bdinner\b|\brestaurant\b/i,
    occasionTags: ["dinner"],
  },
  date: {
    targetFormality: 3,
    indoorOutdoor: "mixed",
    activityLevel: "low",
    pattern: /\bdate\b|date night/i,
    occasionTags: ["date", "date night"],
  },
  party: {
    targetFormality: 3,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\bparty\b|birthday|celebration|\bclub\b|dancing/i,
    occasionTags: ["party"],
  },
  concert: {
    targetFormality: 2,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\bconcert\b|festival|\bgig\b|\bshow\b/i,
    occasionTags: ["concert"],
  },
  travel: {
    targetFormality: 2,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\btravel\b|\btrip\b|flight|airport|vacation|packing/i,
    occasionTags: ["travel"],
  },
  outdoor: {
    targetFormality: 1,
    indoorOutdoor: "outdoor",
    activityLevel: "high",
    pattern: /\bhike|hiking|camping|\boutdoor|\bpark\b|picnic/i,
    occasionTags: ["outdoor"],
  },
  exercise: {
    targetFormality: 1,
    indoorOutdoor: "mixed",
    activityLevel: "high",
    pattern: /\bgym\b|workout|\bexercise\b|\brun\b|running|yoga|pilates|training/i,
    occasionTags: ["exercise", "workout"],
  },
  errands: {
    targetFormality: 1,
    indoorOutdoor: "mixed",
    activityLevel: "moderate",
    pattern: /\berrands?\b|grocery|groceries|\bchores\b|laundromat/i,
    occasionTags: ["errands"],
  },
};

export const CASUAL_PROFILE: CategoryProfile = {
  targetFormality: 1,
  indoorOutdoor: "mixed",
  activityLevel: "moderate",
  pattern: /\bcasual\b|weekend|hang(ing)? out/i,
  occasionTags: ["casual"],
};

export const CATEGORY_PRIORITY: readonly Exclude<OccasionCategory, "casual">[] = [
  "interview",
  "wedding",
  "formal_event",
  "business",
  "work",
  "dinner",
  "date",
  "party",
  "concert",
  "travel",
  "outdoor",
  "exercise",
  "errands",
];

// Casual last: it's the catch-all, checked only after every more specific
// category has had a chance to match.
export const ALL_CATEGORY_PROFILES: readonly (readonly [OccasionCategory, CategoryProfile])[] = [
  ...CATEGORY_PRIORITY.map((category) => [category, CATEGORY_PROFILES[category]] as const),
  ["casual", CASUAL_PROFILE] as const,
];

export function occasionCategoryTags(category: OccasionCategory): readonly string[] {
  return category === "casual"
    ? CASUAL_PROFILE.occasionTags
    : CATEGORY_PROFILES[category].occasionTags;
}

export function occasionCategoryProfile(
  category: OccasionCategory,
): Pick<CategoryProfile, "targetFormality" | "indoorOutdoor" | "activityLevel"> {
  return category === "casual" ? CASUAL_PROFILE : CATEGORY_PROFILES[category];
}

// A regex-matched occasion category is only trustworthy enough to hard-filter
// or score against once its confidence clears this bar; below it, callers
// should treat the request as occasion-agnostic rather than risk excluding
// items on a low-confidence guess.
export const OCCASION_CATEGORY_CONFIDENT_THRESHOLD = 0.5;

export function confidentOccasionTags(
  context: Pick<OccasionContext, "category" | "confidence">,
): readonly string[] | undefined {
  return context.confidence >= OCCASION_CATEGORY_CONFIDENT_THRESHOLD
    ? occasionCategoryTags(context.category)
    : undefined;
}

// Checked independently of occasion category: time cues ("dinner tonight" vs
// "dinner tomorrow morning") don't reliably correlate with which occasion
// category matched, so these are detected directly from the raw text.
const TIME_OF_DAY_PATTERNS: readonly [TimeOfDay, RegExp][] = [
  ["morning", /\bmorning\b|\bbreakfast\b|\bbrunch\b/i],
  ["afternoon", /\bafternoon\b|\blunch\b|\bmidday\b/i],
  ["evening", /\bevening\b|\bdinner\b|\btonight\b|\bafter work\b/i],
  ["night", /\bnight\b|\blate[\s-]?night\b/i],
];

function detectTimeOfDay(text: string): TimeOfDay {
  for (const [timeOfDay, pattern] of TIME_OF_DAY_PATTERNS) {
    if (pattern.test(text)) return timeOfDay;
  }
  return "unspecified";
}

// Explicit dress-code phrasing, captured verbatim (not mapped onto the fixed
// occasion categories) so a stricter constraint than the category's default
// formality is never silently dropped.
const DRESS_CODE_PATTERNS: readonly RegExp[] = [
  /black[\s-]?tie(?:\s+optional)?/i,
  /white[\s-]?tie/i,
  /cocktail attire/i,
  /business casual/i,
  /smart casual/i,
  /no jeans/i,
  /all[\s-]?white/i,
  /all[\s-]?black/i,
  /formal attire/i,
  /costume|themed/i,
];

function detectDressCodeConstraints(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of DRESS_CODE_PATTERNS) {
    const match = text.match(pattern);
    if (match) matches.push(match[0].toLowerCase());
  }
  return matches;
}

function deriveUnresolvedQuestions(
  targetFormality: number,
  confidence: number,
  dressCodeConstraints: readonly string[],
): string[] {
  const questions: string[] = [];
  if (confidence < 0.5) {
    questions.push("What's the occasion, and how dressy should it feel?");
  }
  if (targetFormality >= 4 && dressCodeConstraints.length === 0) {
    questions.push("Is there a specific dress code to follow?");
  }
  return questions;
}

function buildContext(
  category: OccasionCategory,
  profile: Pick<CategoryProfile, "targetFormality" | "indoorOutdoor" | "activityLevel">,
  timeOfDay: TimeOfDay,
  dressCodeConstraints: string[],
  confidence: number,
  matchedKeywords: string[],
): OccasionContext {
  return {
    category,
    targetFormality: profile.targetFormality,
    indoorOutdoor: profile.indoorOutdoor,
    activityLevel: profile.activityLevel,
    timeOfDay,
    dressCodeConstraints,
    confidence,
    matchedKeywords,
    unresolvedQuestions: deriveUnresolvedQuestions(
      profile.targetFormality,
      confidence,
      dressCodeConstraints,
    ),
  };
}

/**
 * Deterministic occasion-context resolver: maps free-form user/request text
 * (never trusted as an exact database tag) onto a fixed set of normalized
 * categories with a target formality, setting, activity level, time of day,
 * any explicit dress-code phrasing, and a confidence score. Unmatched or
 * empty text resolves to "casual" with low confidence rather than failing,
 * since a safe default outfit is still useful; resolveOccasionContextWithEscalation()
 * (lib/ai/agents/occasion-agent.ts) layers structured AI on top of this same
 * return shape for the low-confidence case, without changing this function.
 */
export function resolveOccasionContext(rawText?: string | null): OccasionContext {
  const text = (rawText ?? "").toLowerCase().trim();
  const timeOfDay = detectTimeOfDay(text);
  const dressCodeConstraints = detectDressCodeConstraints(text);

  if (text) {
    for (const [category, profile] of ALL_CATEGORY_PROFILES) {
      const match = text.match(profile.pattern);
      if (match) {
        return buildContext(category, profile, timeOfDay, dressCodeConstraints, 0.8, [match[0]]);
      }
    }
  }

  const confidence = text ? 0.2 : 0;
  return buildContext("casual", CASUAL_PROFILE, timeOfDay, dressCodeConstraints, confidence, []);
}

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

function validateItem(
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
    issues.push(...validateItem(item, selection, options, allowedAvailability));
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

export const RESEARCH_MATCH_STATUSES = ["verified", "likely", "uncertain", "not_found"] as const;

export const RESEARCH_SOURCE_TYPES = [
  "official_brand",
  "retailer",
  "marketplace",
  "other",
] as const;

export type ResearchMatchStatus = (typeof RESEARCH_MATCH_STATUSES)[number];

export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];

export interface ResearchConfidenceInput {
  confidence?: number | null;
  sourceTypes?: readonly ResearchSourceType[];
  exactIdentifierMatch?: boolean;
  userConfirmedBrand?: boolean;
  matchingTextClues?: number;
  visualSimilarityOnly?: boolean;
  candidateFound?: boolean;
}

export interface ResearchConfidenceResult {
  status: ResearchMatchStatus;
  confidence: number;
  reasons: string[];
}

export function mapResearchConfidence(input: ResearchConfidenceInput): ResearchConfidenceResult {
  const rawConfidence = input.confidence ?? 0;
  const confidence = Math.min(1, Math.max(0, Number.isFinite(rawConfidence) ? rawConfidence : 0));
  const sources = input.sourceTypes ?? [];
  const hasOfficialSource = sources.includes("official_brand");
  const hasReliableSource = hasOfficialSource || sources.includes("retailer");
  const rawMatchingTextClues = input.matchingTextClues ?? 0;
  const matchingTextClues = Math.max(
    0,
    Math.floor(Number.isFinite(rawMatchingTextClues) ? rawMatchingTextClues : 0),
  );
  const reasons: string[] = [];
  if (input.candidateFound === false || sources.length === 0) {
    return {
      status: "not_found",
      confidence,
      reasons: [
        sources.length === 0 ? "No supporting source was found." : "No candidate was found.",
      ],
    };
  }
  if (input.visualSimilarityOnly) {
    return {
      status: "uncertain",
      confidence: Math.min(confidence, 0.49),
      reasons: ["Visual similarity alone cannot verify a product identity."],
    };
  }
  if (input.exactIdentifierMatch && hasOfficialSource) {
    return {
      status: "verified",
      confidence: Math.max(confidence, 0.9),
      reasons: ["An exact identifier matches an official brand source."],
    };
  }
  if (
    hasReliableSource &&
    confidence >= 0.7 &&
    (input.exactIdentifierMatch || (input.userConfirmedBrand && matchingTextClues >= 1))
  ) {
    return {
      status: "likely",
      confidence,
      reasons: ["Reliable sources and user-confirmed clues support the match."],
    };
  }
  if (!hasReliableSource)
    reasons.push("No official brand or established retailer source supports the match.");
  if (!input.exactIdentifierMatch)
    reasons.push("No exact SKU, barcode, or model identifier matched.");
  if (confidence < 0.7)
    reasons.push("The evidence confidence is below the likely-match threshold.");
  return { status: "uncertain", confidence, reasons };
}

export const RECOMMENDATION_SCORE_KEYS = [
  "weatherSuitability",
  "occasionFormality",
  "colorHarmony",
  "layeringSilhouette",
  "explicitPreference",
  "variety",
  "metadataConfidence",
] as const;

export type RecommendationScoreKey = (typeof RECOMMENDATION_SCORE_KEYS)[number];

export type RecommendationWeights = Readonly<Record<RecommendationScoreKey, number>>;

export type RecommendationScoreComponents = Readonly<Record<RecommendationScoreKey, number>>;

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = Object.freeze({
  weatherSuitability: 0.25,
  occasionFormality: 0.2,
  colorHarmony: 0.15,
  layeringSilhouette: 0.15,
  explicitPreference: 0.1,
  variety: 0.1,
  metadataConfidence: 0.05,
});

export function assertRecommendationWeights(
  weights: RecommendationWeights,
): asserts weights is RecommendationWeights {
  const values = RECOMMENDATION_SCORE_KEYS.map((key) => weights[key]);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Recommendation weights must be finite, non-negative numbers.");
  }
  if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) {
    throw new Error("Recommendation weights must add up to 1.");
  }
}

export function createRecommendationWeights(
  overrides: Partial<Record<RecommendationScoreKey, number>> = {},
): RecommendationWeights {
  const merged = { ...DEFAULT_RECOMMENDATION_WEIGHTS, ...overrides };
  const values = RECOMMENDATION_SCORE_KEYS.map((key) => merged[key]);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Recommendation weights must be finite, non-negative numbers.");
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("At least one recommendation weight must be positive.");
  return Object.freeze(
    Object.fromEntries(
      RECOMMENDATION_SCORE_KEYS.map((key) => [key, merged[key] / total]),
    ) as unknown as Record<RecommendationScoreKey, number>,
  );
}

export function weightedRecommendationScore(
  components: RecommendationScoreComponents,
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
) {
  assertRecommendationWeights(weights);
  return RECOMMENDATION_SCORE_KEYS.reduce(
    (total, key) => total + Math.min(1, Math.max(0, components[key])) * weights[key],
    0,
  );
}

export interface CandidatePreferenceContext {
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: ReadonlySet<string> | readonly string[];
  dislikedItemIds?: ReadonlySet<string> | readonly string[];
}

export interface CandidateScoringContext {
  weather?: ClothingConstraints;
  occasionTags?: readonly string[];
  targetFormality?: number;
  preferences?: CandidatePreferenceContext;
  selectedItems?: readonly WardrobeItem[];
  recentlyWornItemIds?: ReadonlySet<string> | readonly string[];
}

export interface CandidateScore {
  itemId: string;
  total: number;
  components: RecommendationScoreComponents;
}

const clampScore = (value: number) => Math.min(1, Math.max(0, value));

const normalizePreference = (value: string) => value.trim().toLowerCase();

const asSet = (values: ReadonlySet<string> | readonly string[] | undefined) =>
  values instanceof Set ? values : new Set(values ?? []);

function scoreWeather(item: WardrobeItem, weather: ClothingConstraints | undefined) {
  if (!weather) return 0.65;
  const role = resolveWardrobeItemRole(item);
  const roleAdjustment = role === "layer" ? 0 : role === "top" || role === "bottom" ? -1 : -0.5;
  const target = Math.max(1, weather.targetWarmthLevel + roleAdjustment);
  let score = item.warmth_level === null ? 0.6 : 1 - Math.abs(item.warmth_level - target) / 4;
  const tags = new Set(item.weather_tags.map(normalizePreference));
  if (weather.rainProtectionRequired && role === "shoes") {
    if (item.water_resistance === "waterproof" || item.water_resistance === "water_resistant") {
      score += 0.15;
    } else if (tags.has("rain_unsafe") || tags.has("dry_weather_only")) {
      score -= 0.5;
    }
  }
  if (weather.breathablePriority && tags.has("breathable")) score += 0.15;
  if (weather.windProtectionRequired && tags.has("windproof")) score += 0.15;
  return clampScore(score);
}

function scoreOccasion(item: WardrobeItem, context: CandidateScoringContext) {
  const targetTags = new Set((context.occasionTags ?? []).map(normalizePreference));
  let tagScore = 0.65;
  if (targetTags.size > 0) {
    const itemTags = item.occasion_tags.map(normalizePreference);
    tagScore =
      itemTags.length === 0 ? 0.58 : itemTags.some((tag) => targetTags.has(tag)) ? 1 : 0.35;
  }
  let formalityScore = 0.65;
  if (context.targetFormality !== undefined && item.formality_level !== null) {
    formalityScore = clampScore(1 - Math.abs(item.formality_level - context.targetFormality) / 4);
  }
  return tagScore * 0.55 + formalityScore * 0.45;
}

function scorePreference(item: WardrobeItem, preferences: CandidatePreferenceContext | undefined) {
  if (!preferences) return item.favorite ? 0.75 : 0.55;
  if (asSet(preferences.dislikedItemIds).has(item.id)) return 0;
  let score = item.favorite ? 0.72 : 0.52;
  if (asSet(preferences.likedItemIds).has(item.id)) score += 0.25;
  const itemColors = new Set(item.color_names.map(normalizePreference));
  if (
    (preferences.favoriteColors ?? [])
      .map(normalizePreference)
      .some((color) => itemColors.has(color))
  ) {
    score += 0.18;
  }
  if (
    (preferences.avoidedColors ?? [])
      .map(normalizePreference)
      .some((color) => itemColors.has(color))
  ) {
    score -= 0.45;
  }
  const preferredFits = (preferences.preferredFits ?? []).map(normalizePreference);
  if (item.fit && preferredFits.includes(normalizePreference(item.fit))) score += 0.12;
  return clampScore(score);
}

function scoreVariety(
  item: WardrobeItem,
  recentlyWornItemIds: CandidateScoringContext["recentlyWornItemIds"],
) {
  if (asSet(recentlyWornItemIds).has(item.id)) return 0.2;
  return clampScore(Math.max(0.35, 0.95 - Math.min(item.wear_count, 30) / 40));
}

function scoreWithSharedOutfitContext(
  item: WardrobeItem,
  context: CandidateScoringContext,
  weights: RecommendationWeights,
  colorHarmony: number,
  layeringSilhouette: number,
): CandidateScore {
  const components: RecommendationScoreComponents = {
    weatherSuitability: scoreWeather(item, context.weather),
    occasionFormality: scoreOccasion(item, context),
    colorHarmony,
    layeringSilhouette,
    explicitPreference: scorePreference(item, context.preferences),
    variety: scoreVariety(item, context.recentlyWornItemIds),
    metadataConfidence: item.metadata_confidence ?? 0.5,
  };
  return { itemId: item.id, total: weightedRecommendationScore(components, weights), components };
}

export function scoreWardrobeCandidate(
  item: WardrobeItem,
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
): CandidateScore {
  const outfit = [...(context.selectedItems ?? []), item];
  return scoreWithSharedOutfitContext(
    item,
    context,
    weights,
    scoreColorHarmony(outfit),
    analyzeLayering(outfit).score,
  );
}

export function scoreWardrobeOutfit(
  items: readonly WardrobeItem[],
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
): CandidateScore[] {
  const colorHarmony = scoreColorHarmony(items);
  const layeringSilhouette = analyzeLayering(items).score;
  return items.map((item) =>
    scoreWithSharedOutfitContext(item, context, weights, colorHarmony, layeringSilhouette),
  );
}

export function rankWardrobeCandidates(
  items: readonly WardrobeItem[],
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
) {
  return items
    .map((item) => scoreWardrobeCandidate(item, context, weights))
    .sort(
      (first, second) => second.total - first.total || first.itemId.localeCompare(second.itemId),
    );
}
