import type { TemperatureBand } from "@/lib/weather";
import type { WardrobeItem } from "@/features/wardrobe";
import {
  type CandidateScore,
  type CandidateScoringContext,
  scoreWardrobeCandidate,
} from "@/lib/recommendation";
import type { WardrobeItemRole } from "@/features/wardrobe";
import { warmthTargets, type ClothingConstraints } from "@/lib/weather";
import type { CandidatePreferenceContext, OccasionCategory } from "@/lib/recommendation";
import { resolveWardrobeItemRole } from "@/lib/recommendation";
import { TEMPERATURE_BANDS } from "@/lib/weather";
import type { OutfitPlanProposal } from "@/features/outfits";
import { outfitCombinationKey, scoreWardrobeOutfit } from "@/lib/recommendation";
import { selectBalancedOutfitPlans } from "@/lib/recommendation";
import {
  OCCASION_CATEGORIES,
  occasionCategoryProfile,
  occasionCategoryTags,
} from "@/lib/recommendation";

export const OPTIONAL_ROLE_SCORE_THRESHOLD = 0.5;

export const MAX_SHOE_VARIANTS = 2;

export const MAX_ACCESSORY_VARIANTS = 2;

export const MAX_FOUNDATIONS_PER_BUCKET_DEFAULT = 60;

// How many layer/footwear/accessory variants of the *same* foundation within
// one bucket are allowed to survive final selection (selectBalancedOutfitPlans
// otherwise treats repeated use of one foundation as low-diversity noise).
export const MAX_VARIANTS_PER_FOUNDATION_BUCKET = 6;

// Bands whose comfort range an outfit's aggregate warmth reasonably covers
// (tolerance of 1 warmth point either side of the band's own target).
export const WEATHER_BAND_TOLERANCE = 1;

export const RAIN_SAFE_WATER_RESISTANCE = new Set(["water_resistant", "waterproof"]);

// Representative midpoint temperatures purely for the synthetic constraints in
// synthetic-weather.ts; scoreWeather() never reads these fields directly (only
// targetWarmthLevel/rainProtectionRequired/breathablePriority/
// windProtectionRequired), so they only need to be internally consistent.
export const BAND_REPRESENTATIVE_TEMPERATURE_C: Record<TemperatureBand, number> = {
  extreme_cold: -10,
  cold: 0,
  cool: 9,
  mild: 17,
  warm: 24,
  hot: 30,
  extreme_hot: 37,
};

// Bounds the extra weather-biased fan-out to the foundations most likely to
// be suggested at all, keeping the added cost a small constant factor per
// bucket rather than growing with wardrobe size.
export const WEATHER_VARIANT_FOUNDATION_LIMIT = 10;

export function average(values: readonly number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type ScoredItem = { item: WardrobeItem; score: CandidateScore };

export function quickFoundationScore(
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

export function topScoredItems(
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
export function buildOptionalRoleVariants(
  foundation: readonly WardrobeItem[],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  context: CandidateScoringContext,
): { selected: WardrobeItem[] }[] {
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

  const results: { selected: WardrobeItem[] }[] = [];
  for (const layer of layerVariants) {
    for (const shoes of shoeVariants) {
      for (const accessory of accessoryVariants) {
        const scored = [layer, shoes, accessory].filter(
          (entry): entry is ScoredItem => entry !== null,
        );
        results.push({ selected: [...foundation, ...scored.map((entry) => entry.item)] });
      }
    }
  }
  return results;
}

/**
 * A synthetic (non-forecast) ClothingConstraints used only to bias which
 * layer/shoe/accessory a compile-time variant prefers, so the library holds
 * genuinely different item picks per weather condition instead of one
 * candidate re-tagged five ways. Distinct from deriveClothingConstraints(),
 * which turns a real Open-Meteo forecast into constraints at retrieval time.
 */
function syntheticWeatherConstraints(band: TemperatureBand, rain: boolean): ClothingConstraints {
  const targets = warmthTargets(band);
  const isCold = band === "cold" || band === "extreme_cold";
  const isHot = band === "hot" || band === "extreme_hot";
  const temperatureC = BAND_REPRESENTATIVE_TEMPERATURE_C[band];
  return {
    effectiveTemperatureC: temperatureC,
    effectiveMinimumC: temperatureC,
    effectiveMaximumC: temperatureC,
    temperatureBand: band,
    ...targets,
    needsOuterLayer: isCold,
    needsInsulation: band === "extreme_cold",
    windProtectionRequired: false,
    rainProtectionRequired: rain,
    rainSafeShoesRequired: rain,
    snowSafeFootwearRequired: false,
    breathablePriority: isHot,
    avoidHeavyLayers: isHot,
    dayNightLayerRecommended: false,
    tags: rain ? ["rain_protection", "rain_safe_shoes"] : [],
  };
}

// The five weather conditions the spec calls out by name. "rain" biases
// toward rain-safe shoes/layers at a mild temperature rather than a fixed
// band of its own, since precipitation is orthogonal to temperature.
const WEATHER_VARIANT_CONTEXTS: readonly { weather: ClothingConstraints }[] = [
  { weather: syntheticWeatherConstraints("cold", false) },
  { weather: syntheticWeatherConstraints("mild", false) },
  { weather: syntheticWeatherConstraints("warm", false) },
  { weather: syntheticWeatherConstraints("hot", false) },
  { weather: syntheticWeatherConstraints("mild", true) },
];

export function addWeatherBiasedVariants(
  rankedFoundations: readonly WardrobeItem[][],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  context: CandidateScoringContext,
  addVariant: (
    variant: ReturnType<typeof buildOptionalRoleVariants>[number],
    variantContext: CandidateScoringContext,
  ) => void,
) {
  for (const foundation of rankedFoundations.slice(0, WEATHER_VARIANT_FOUNDATION_LIMIT)) {
    for (const { weather } of WEATHER_VARIANT_CONTEXTS) {
      const weatherContext: CandidateScoringContext = { ...context, weather };
      for (const variant of buildOptionalRoleVariants(foundation, groups, weatherContext)) {
        addVariant(variant, weatherContext);
      }
    }
  }
}

export interface CompilationBucket {
  key: OccasionCategory;
  occasionTags: readonly string[];
  targetFormality: number;
}

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
  // Every bucket a combination fits, not just the one that produced it first
  // -- see populate-candidates.ts's addVariant merge logic. Always includes
  // occasionCategory.
  occasionCategories: OccasionCategory[];
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

function buildRoleAssignments(selected: readonly WardrobeItem[]): GeneratedOutfitCandidateItem[] {
  return selected.map((item, index) => {
    const role = resolveWardrobeItemRole(item);
    if (!role) throw new Error("A scored outfit candidate item has no resolvable role.");
    return { itemId: item.id, role, sortOrder: index };
  });
}

export function buildCandidateMetadata(
  combinationKey: string,
  selected: readonly WardrobeItem[],
  allScores: readonly CandidateScore[],
  bucket: CompilationBucket,
): GeneratedOutfitCandidate {
  const formalityLevels = selected
    .map((item) => item.formality_level)
    .filter((value): value is number => value !== null);
  const warmthLevels = selected
    .map((item) => item.warmth_level)
    .filter((value): value is number => value !== null);

  return {
    combinationKey,
    items: buildRoleAssignments(selected),
    totalScore: average(allScores.map((score) => score.total)),
    colorHarmony: average(allScores.map((score) => score.components.colorHarmony)),
    layeringQuality: average(allScores.map((score) => score.components.layeringSilhouette)),
    occasionFormality: average(allScores.map((score) => score.components.occasionFormality)),
    preferenceMatch: average(allScores.map((score) => score.components.explicitPreference)),
    variety: average(allScores.map((score) => score.components.variety)),
    occasionTags: [...bucket.occasionTags],
    occasionCategory: bucket.key,
    occasionCategories: [bucket.key],
    weatherTags: weatherTagsForOutfit(selected),
    formalityLevel: formalityLevels.length ? Math.round(average(formalityLevels)) : null,
    warmthLevel: warmthLevels.length ? Math.round(average(warmthLevels)) : null,
    bucketKey: bucket.key,
  };
}

export function buildGeneratedCandidate(
  variant: { selected: WardrobeItem[] },
  context: CandidateScoringContext,
  bucket: CompilationBucket,
): { proposal: OutfitPlanProposal; metadata: GeneratedOutfitCandidate } | null {
  const { selected } = variant;
  const allScores = scoreWardrobeOutfit(selected, context);
  if (allScores.length === 0) return null;

  const itemIds = selected.map((item) => item.id);
  const combinationKey = outfitCombinationKey(itemIds);

  return {
    proposal: {
      id: combinationKey,
      item_ids: itemIds,
      base_score: average(allScores.map((score) => score.total)),
    },
    metadata: buildCandidateMetadata(combinationKey, selected, allScores, bucket),
  };
}

/**
 * Top/bottom pairs ordered so every top and every bottom is used once before
 * any single garment is reused.
 *
 * The nested loop this replaces walked tops in the outer position, so a
 * truncated budget paired the first top with every bottom and left every other
 * top unrepresented. Walking the diagonals instead means a budget of N covers
 * min(N, tops, bottoms) distinct tops *and* distinct bottoms, which is what
 * gives the Safe/Fresh/Statement selection genuinely different material.
 */
export function interleaveSeparates(
  tops: readonly WardrobeItem[],
  bottoms: readonly WardrobeItem[],
  limit: number,
): WardrobeItem[][] {
  if (limit <= 0 || tops.length === 0 || bottoms.length === 0) return [];

  const pairs: WardrobeItem[][] = [];
  for (let offset = 0; offset < bottoms.length && pairs.length < limit; offset += 1) {
    for (let index = 0; index < tops.length && pairs.length < limit; index += 1) {
      const top = tops[index];
      const bottom = bottoms[(index + offset) % bottoms.length];
      if (top && bottom) pairs.push([top, bottom]);
    }
  }
  return pairs;
}

/**
 * Builds the foundation set the candidate library is generated from.
 *
 * Deliberately not "take the first N in insertion order", which is what this
 * replaces: that emitted every dress before any separates, so a wardrobe with
 * enough dresses produced a library containing no top-and-bottom looks at all,
 * and the nested top×bottom loop paired only the first few tops with anything.
 * Either way the three variants had nothing genuinely different to choose
 * between.
 *
 * Instead the budget is split between the two foundation families by what each
 * can actually supply, and within separates the pairs are interleaved so every
 * top and every bottom appears before any garment repeats.
 */
export function buildFoundations(
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  maxFoundations: number,
) {
  if (maxFoundations <= 0) return [];

  const dresses = groups.get("dress") ?? [];
  const tops = groups.get("top") ?? [];
  const bottoms = groups.get("bottom") ?? [];
  const separatesAvailable = tops.length * bottoms.length;

  const dressShare = Math.min(
    dresses.length,
    separatesAvailable === 0 ? maxFoundations : Math.ceil(maxFoundations / 2),
  );
  const foundations: WardrobeItem[][] = dresses.slice(0, dressShare).map((dress) => [dress]);

  const separatesShare = Math.min(separatesAvailable, maxFoundations - foundations.length);
  foundations.push(...interleaveSeparates(tops, bottoms, separatesShare));

  // Budget the smaller family could not use goes back to the other one.
  for (const dress of dresses.slice(dressShare)) {
    if (foundations.length >= maxFoundations) break;
    foundations.push([dress]);
  }
  return foundations.slice(0, maxFoundations);
}

export function groupByRole(items: readonly WardrobeItem[]) {
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

/**
 * An earlier bucket may have already produced this exact combination -- in
 * that case keep its metadata/score, but record that this bucket fits it
 * too, rather than silently losing the occasion (dedup was previously pure
 * combinationKey equality, so only the first bucket's fit was ever
 * retrievable).
 */
function mergeOrAddCandidate(
  proposals: OutfitPlanProposal[],
  metadataByProposalId: Map<string, GeneratedOutfitCandidate>,
  built: { proposal: OutfitPlanProposal; metadata: GeneratedOutfitCandidate } | null,
  bucket: CompilationBucket,
) {
  if (!built) return;
  const existing = metadataByProposalId.get(built.proposal.id);
  if (existing) {
    if (!existing.occasionCategories.includes(bucket.key)) {
      existing.occasionCategories.push(bucket.key);
    }
    return;
  }
  proposals.push(built.proposal);
  metadataByProposalId.set(built.proposal.id, built.metadata);
}

function rankFoundations(
  foundations: readonly WardrobeItem[][],
  context: CandidateScoringContext,
  limit: number,
): WardrobeItem[][] {
  return foundations
    .map((foundation) => ({ foundation, score: quickFoundationScore(foundation, context) }))
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((entry) => entry.foundation);
}

export function populateCandidateProposals(
  foundations: readonly WardrobeItem[][],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  buckets: readonly CompilationBucket[],
  maxFoundationsPerBucket: number,
  preferences: CandidatePreferenceContext | undefined,
) {
  const proposals: OutfitPlanProposal[] = [];
  const metadataByProposalId = new Map<string, GeneratedOutfitCandidate>();

  for (const bucket of buckets) {
    const context: CandidateScoringContext = {
      occasionTags: bucket.occasionTags,
      targetFormality: bucket.targetFormality,
      preferences,
    };

    function addVariant(
      variant: Parameters<typeof buildGeneratedCandidate>[0],
      variantContext: CandidateScoringContext,
    ) {
      const built = buildGeneratedCandidate(variant, variantContext, bucket);
      mergeOrAddCandidate(proposals, metadataByProposalId, built, bucket);
    }

    const rankedFoundations = rankFoundations(foundations, context, maxFoundationsPerBucket);

    for (const foundation of rankedFoundations) {
      for (const variant of buildOptionalRoleVariants(foundation, groups, context)) {
        addVariant(variant, context);
      }
    }

    addWeatherBiasedVariants(rankedFoundations, groups, context, addVariant);
  }

  return { proposals, metadataByProposalId };
}

// One bucket per normalized occasion category so compiled candidates carry a
// structured, retrieval-filterable occasion signal instead of only raw
// free-text tags. Weather is deliberately excluded here: it changes daily and
// is re-applied as a live filter/adjustment at retrieval time instead of
// being baked in — weather_tags below capture only which conditions a
// candidate's own garments comfortably cover, not "today's" forecast.
const DEFAULT_COMPILATION_BUCKETS: readonly CompilationBucket[] = OCCASION_CATEGORIES.map(
  (category) => ({
    key: category,
    occasionTags: occasionCategoryTags(category),
    targetFormality: occasionCategoryProfile(category).targetFormality,
  }),
);

/**
 * Greedily fills each outfit role using the same pairwise scoring the
 * shortlist/stylist path already applies, expands a small bounded set of
 * layer/footwear/accessory variants per foundation — both band-agnostic and,
 * for the top-ranked foundations, weather-biased (cold/mild/warm/hot/rain) so
 * the library holds genuinely different item picks per condition, not one
 * candidate re-tagged five ways — then runs every candidate through the
 * existing selectBalancedOutfitPlans for dedup and diversity. Intended to run
 * inside the wardrobe compilation job, not on the request path.
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

  const { proposals, metadataByProposalId } = populateCandidateProposals(
    foundations,
    groups,
    buckets,
    maxFoundationsPerBucket,
    options.preferences,
  );

  const { selected } = selectBalancedOutfitPlans(proposals, items, {
    count: maxCandidates,
    maximumFoundationRepeats: Math.max(1, buckets.length) * MAX_VARIANTS_PER_FOUNDATION_BUCKET,
  });

  return selected
    .map((proposal) => metadataByProposalId.get(proposal.id))
    .filter((candidate): candidate is GeneratedOutfitCandidate => candidate !== undefined);
}
