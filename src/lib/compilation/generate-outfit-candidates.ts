import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import {
  type CandidatePreferenceContext,
  type CandidateScore,
  type CandidateScoringContext,
  OCCASION_CATEGORIES,
  occasionCategoryProfile,
  occasionCategoryTags,
  outfitCombinationKey,
  resolveWardrobeItemRole,
  scoreWardrobeCandidate,
  selectBalancedOutfitPlans,
  type OccasionCategory,
} from "@/lib/recommendation";
import { TEMPERATURE_BANDS, warmthTargets, type TemperatureBand } from "@/lib/weather";

export interface CompilationBucket {
  key: OccasionCategory;
  occasionTags: readonly string[];
  targetFormality: number;
}

// One bucket per normalized occasion category so compiled candidates carry a
// structured, retrieval-filterable occasion signal instead of only raw
// free-text tags. Weather is deliberately excluded here: it changes daily and
// is re-applied as a live filter/adjustment at retrieval time instead of
// being baked in — weather_tags below capture only which conditions a
// candidate's own garments comfortably cover, not "today's" forecast.
export const DEFAULT_COMPILATION_BUCKETS: readonly CompilationBucket[] = OCCASION_CATEGORIES.map(
  (category) => ({
    key: category,
    occasionTags: occasionCategoryTags(category),
    targetFormality: occasionCategoryProfile(category).targetFormality,
  }),
);

export interface GeneratedOutfitCandidateItem {
  itemId: string;
  role: WardrobeItemRole;
  sortOrder: number;
}

export interface GeneratedOutfitCandidate {
  combinationKey: string;
  items: GeneratedOutfitCandidateItem[];
  totalScore: number;
  colorHarmony: number;
  layeringQuality: number;
  occasionFormality: number;
  preferenceMatch: number;
  variety: number;
  occasionTags: string[];
  occasionCategory: OccasionCategory;
  weatherTags: string[];
  formalityLevel: number | null;
  warmthLevel: number | null;
  bucketKey: string;
}

export interface GenerateOutfitCandidatesOptions {
  buckets?: readonly CompilationBucket[];
  maxCandidates?: number;
  maxFoundations?: number;
  maxFoundationsPerBucket?: number;
  preferences?: CandidatePreferenceContext;
}

const OPTIONAL_ROLE_SCORE_THRESHOLD = 0.5;
const MAX_SHOE_VARIANTS = 2;
const MAX_ACCESSORY_VARIANTS = 2;
const MAX_FOUNDATIONS_PER_BUCKET_DEFAULT = 60;
// How many layer/footwear/accessory variants of the *same* foundation within
// one bucket are allowed to survive final selection (selectBalancedOutfitPlans
// otherwise treats repeated use of one foundation as low-diversity noise).
const MAX_VARIANTS_PER_FOUNDATION_BUCKET = 6;
// Bands whose comfort range an outfit's aggregate warmth reasonably covers
// (tolerance of 1 warmth point either side of the band's own target).
const WEATHER_BAND_TOLERANCE = 1;
const RAIN_SAFE_WATER_RESISTANCE = new Set(["water_resistant", "waterproof"]);

function average(values: readonly number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupByRole(items: readonly WardrobeItem[]) {
  const groups = new Map<WardrobeItemRole, WardrobeItem[]>();
  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (!role) continue;
    const group = groups.get(role) ?? [];
    group.push(item);
    groups.set(role, group);
  }
  return groups;
}

function buildFoundations(groups: Map<WardrobeItemRole, WardrobeItem[]>, maxFoundations: number) {
  const foundations: WardrobeItem[][] = [];
  for (const dress of groups.get("dress") ?? []) {
    foundations.push([dress]);
    if (foundations.length >= maxFoundations) return foundations;
  }
  for (const top of groups.get("top") ?? []) {
    for (const bottom of groups.get("bottom") ?? []) {
      foundations.push([top, bottom]);
      if (foundations.length >= maxFoundations) return foundations;
    }
  }
  return foundations;
}

function quickFoundationScore(
  foundation: readonly WardrobeItem[],
  context: CandidateScoringContext,
) {
  return average(
    foundation.map(
      (item) =>
        scoreWardrobeCandidate(item, {
          ...context,
          selectedItems: foundation.filter((candidate) => candidate.id !== item.id),
        }).total,
    ),
  );
}

type ScoredItem = { item: WardrobeItem; score: CandidateScore };

function topScoredItems(
  pool: readonly WardrobeItem[],
  selected: readonly WardrobeItem[],
  context: CandidateScoringContext,
  limit: number,
): ScoredItem[] {
  return pool
    .map((item) => ({
      item,
      score: scoreWardrobeCandidate(item, { ...context, selectedItems: selected }),
    }))
    .sort((first, second) => second.score.total - first.score.total)
    .slice(0, limit);
}

/**
 * Bounded per-foundation fan-out: up to 2 layer states (with the best-fitting
 * layer, and without) x up to 2 shoe options x up to 3 accessory states (none,
 * plus up to 2 good-fit accessories) = at most 12 small, deterministic
 * variants per foundation+bucket. This is a fixed constant factor per
 * foundation, not an unbounded Cartesian product over the whole wardrobe.
 */
function buildOptionalRoleVariants(
  foundation: readonly WardrobeItem[],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  context: CandidateScoringContext,
): { selected: WardrobeItem[]; scored: ScoredItem[] }[] {
  const shoeOptions = topScoredItems(
    groups.get("shoes") ?? [],
    foundation,
    context,
    MAX_SHOE_VARIANTS,
  );
  // Shoes complete almost every outfit, so only fall back to "no shoes" when
  // none are owned at all; layers/accessories default to "not included".
  const shoeVariants: (ScoredItem | null)[] = shoeOptions.length > 0 ? shoeOptions : [null];

  const bestLayer = topScoredItems(groups.get("layer") ?? [], foundation, context, 1)[0];
  const layerVariants: (ScoredItem | null)[] =
    bestLayer && bestLayer.score.total >= OPTIONAL_ROLE_SCORE_THRESHOLD
      ? [bestLayer, null]
      : [null];

  const accessoryOptions = topScoredItems(
    groups.get("accessory") ?? [],
    foundation,
    context,
    MAX_ACCESSORY_VARIANTS,
  ).filter((entry) => entry.score.total >= OPTIONAL_ROLE_SCORE_THRESHOLD);
  const accessoryVariants: (ScoredItem | null)[] = [null, ...accessoryOptions];

  const results: { selected: WardrobeItem[]; scored: ScoredItem[] }[] = [];
  for (const layer of layerVariants) {
    for (const shoes of shoeVariants) {
      for (const accessory of accessoryVariants) {
        const scored = [layer, shoes, accessory].filter(
          (entry): entry is ScoredItem => entry !== null,
        );
        results.push({ selected: [...foundation, ...scored.map((entry) => entry.item)], scored });
      }
    }
  }
  return results;
}

function weatherTagsForOutfit(items: readonly WardrobeItem[]): string[] {
  const warmthLevels = items
    .map((item) => item.warmth_level)
    .filter((value): value is number => value !== null);
  const tags: string[] = [];
  if (warmthLevels.length > 0) {
    const averageWarmth = average(warmthLevels);
    for (const band of TEMPERATURE_BANDS as readonly TemperatureBand[]) {
      if (
        Math.abs(averageWarmth - warmthTargets(band).targetWarmthLevel) <= WEATHER_BAND_TOLERANCE
      ) {
        tags.push(band);
      }
    }
  }
  const hasRainSafeGear = items.some(
    (item) =>
      (item.layer_role === "shoes" || item.layer_role === "layer") &&
      item.water_resistance !== null &&
      RAIN_SAFE_WATER_RESISTANCE.has(item.water_resistance),
  );
  if (hasRainSafeGear) tags.push("rain_safe");
  return tags;
}

/**
 * Greedily fills each outfit role using the same pairwise scoring the
 * shortlist/stylist path already applies, expands a small bounded set of
 * layer/footwear/accessory variants per foundation, then runs every candidate
 * through the existing selectBalancedOutfitPlans for dedup and diversity.
 * Intended to run inside the wardrobe compilation job, not on the request
 * path.
 */
export function generateOutfitCandidates(
  items: readonly WardrobeItem[],
  options: GenerateOutfitCandidatesOptions = {},
): GeneratedOutfitCandidate[] {
  const buckets = options.buckets ?? DEFAULT_COMPILATION_BUCKETS;
  const maxFoundations = options.maxFoundations ?? 2000;
  const maxFoundationsPerBucket =
    options.maxFoundationsPerBucket ?? MAX_FOUNDATIONS_PER_BUCKET_DEFAULT;
  const maxCandidates = options.maxCandidates ?? Math.min(1000, Math.max(20, items.length * 8));

  const groups = groupByRole(items);
  const foundations = buildFoundations(groups, maxFoundations);
  if (foundations.length === 0) return [];

  const proposals: OutfitPlanProposal[] = [];
  const metadataByProposalId = new Map<string, GeneratedOutfitCandidate>();

  for (const bucket of buckets) {
    const context: CandidateScoringContext = {
      occasionTags: bucket.occasionTags,
      targetFormality: bucket.targetFormality,
      preferences: options.preferences,
    };

    const rankedFoundations = foundations
      .map((foundation) => ({ foundation, score: quickFoundationScore(foundation, context) }))
      .sort((first, second) => second.score - first.score)
      .slice(0, maxFoundationsPerBucket)
      .map((entry) => entry.foundation);

    for (const foundation of rankedFoundations) {
      for (const variant of buildOptionalRoleVariants(foundation, groups, context)) {
        const { selected, scored } = variant;
        const foundationScores = foundation.map((item) =>
          scoreWardrobeCandidate(item, {
            ...context,
            selectedItems: selected.filter((candidate) => candidate.id !== item.id),
          }),
        );
        const allScores = [...foundationScores, ...scored.map((entry) => entry.score)];
        if (allScores.length === 0) continue;

        const itemIds = selected.map((item) => item.id);
        const combinationKey = outfitCombinationKey(itemIds);
        if (metadataByProposalId.has(combinationKey)) continue;

        const roleAssignments: GeneratedOutfitCandidateItem[] = selected.map((item, index) => {
          const role = resolveWardrobeItemRole(item);
          if (!role) throw new Error("A scored outfit candidate item has no resolvable role.");
          return { itemId: item.id, role, sortOrder: index };
        });

        const formalityLevels = selected
          .map((item) => item.formality_level)
          .filter((value): value is number => value !== null);
        const warmthLevels = selected
          .map((item) => item.warmth_level)
          .filter((value): value is number => value !== null);

        proposals.push({
          id: combinationKey,
          item_ids: itemIds,
          base_score: average(allScores.map((score) => score.total)),
        });
        metadataByProposalId.set(combinationKey, {
          combinationKey,
          items: roleAssignments,
          totalScore: average(allScores.map((score) => score.total)),
          colorHarmony: average(allScores.map((score) => score.components.colorHarmony)),
          layeringQuality: average(allScores.map((score) => score.components.layeringSilhouette)),
          occasionFormality: average(allScores.map((score) => score.components.occasionFormality)),
          preferenceMatch: average(allScores.map((score) => score.components.explicitPreference)),
          variety: average(allScores.map((score) => score.components.variety)),
          occasionTags: [...bucket.occasionTags],
          occasionCategory: bucket.key,
          weatherTags: weatherTagsForOutfit(selected),
          formalityLevel: formalityLevels.length ? Math.round(average(formalityLevels)) : null,
          warmthLevel: warmthLevels.length ? Math.round(average(warmthLevels)) : null,
          bucketKey: bucket.key,
        });
      }
    }
  }

  const { selected } = selectBalancedOutfitPlans(proposals, items, {
    count: maxCandidates,
    maximumFoundationRepeats: Math.max(1, buckets.length) * MAX_VARIANTS_PER_FOUNDATION_BUCKET,
  });

  return selected
    .map((proposal) => metadataByProposalId.get(proposal.id))
    .filter((candidate): candidate is GeneratedOutfitCandidate => candidate !== undefined);
}
