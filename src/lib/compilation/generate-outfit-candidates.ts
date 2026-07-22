import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import {
  type CandidatePreferenceContext,
  type CandidateScore,
  type CandidateScoringContext,
  outfitCombinationKey,
  outfitFoundationKey,
  resolveWardrobeItemRole,
  scoreWardrobeCandidate,
  selectBalancedOutfitPlans,
} from "@/lib/recommendation";

export interface CompilationBucket {
  key: string;
  occasionTags?: readonly string[];
  targetFormality?: number;
}

// Buckets stand in for "what kind of day is this outfit for" at compile time.
// Weather is deliberately excluded here: it changes daily and is re-applied as
// a live filter/adjustment at retrieval time instead of being baked in.
export const DEFAULT_COMPILATION_BUCKETS: readonly CompilationBucket[] = [
  { key: "casual", targetFormality: 1 },
  { key: "smart_casual", targetFormality: 2 },
  { key: "business", targetFormality: 3, occasionTags: ["work", "business"] },
  { key: "date_night", targetFormality: 3, occasionTags: ["date", "dinner"] },
  { key: "formal", targetFormality: 4, occasionTags: ["formal", "event"] },
];

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
  formalityLevel: number | null;
  warmthLevel: number | null;
  bucketKey: string;
}

export interface GenerateOutfitCandidatesOptions {
  buckets?: readonly CompilationBucket[];
  maxCandidates?: number;
  maxFoundations?: number;
  preferences?: CandidatePreferenceContext;
}

const OPTIONAL_ROLES: readonly WardrobeItemRole[] = ["layer", "shoes", "accessory"];
const OPTIONAL_ROLE_SCORE_THRESHOLD = 0.5;

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

function fillOptionalRoles(
  foundation: readonly WardrobeItem[],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  context: CandidateScoringContext,
) {
  const selected = [...foundation];
  const scored: { item: WardrobeItem; score: CandidateScore }[] = [];

  for (const role of OPTIONAL_ROLES) {
    const pool = groups.get(role) ?? [];
    if (pool.length === 0) continue;

    let best: { item: WardrobeItem; score: CandidateScore } | null = null;
    for (const candidate of pool) {
      const score = scoreWardrobeCandidate(candidate, { ...context, selectedItems: selected });
      if (!best || score.total > best.score.total) best = { item: candidate, score };
    }
    if (!best) continue;

    // Shoes complete almost every outfit; layers/accessories only join when
    // they're a genuinely good fit for this foundation, not just the best of a
    // mediocre pool.
    const isNearlyAlwaysWorn = role === "shoes";
    if (isNearlyAlwaysWorn || best.score.total >= OPTIONAL_ROLE_SCORE_THRESHOLD) {
      selected.push(best.item);
      scored.push(best);
    }
  }

  return { selected, scored };
}

/**
 * Greedily fills each outfit role using the same pairwise scoring the
 * shortlist/stylist path already applies, then runs every candidate through
 * the existing (previously unused) selectBalancedOutfitPlans for dedup and
 * diversity. Intended to run inside the wardrobe compilation job, not on the
 * request path.
 */
export function generateOutfitCandidates(
  items: readonly WardrobeItem[],
  options: GenerateOutfitCandidatesOptions = {},
): GeneratedOutfitCandidate[] {
  const buckets = options.buckets ?? DEFAULT_COMPILATION_BUCKETS;
  const maxFoundations = options.maxFoundations ?? 2000;
  const maxCandidates = options.maxCandidates ?? Math.min(500, Math.max(20, items.length * 6));

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

    for (const foundation of foundations) {
      const { selected, scored } = fillOptionalRoles(foundation, groups, context);
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
      const foundationKey = outfitFoundationKey(itemIds, selected) ?? itemIds.join(":");
      const proposalId = `${foundationKey}:${bucket.key}`.slice(0, 120);

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
        id: proposalId,
        item_ids: itemIds,
        base_score: average(allScores.map((score) => score.total)),
      });
      metadataByProposalId.set(proposalId, {
        combinationKey,
        items: roleAssignments,
        totalScore: average(allScores.map((score) => score.total)),
        colorHarmony: average(allScores.map((score) => score.components.colorHarmony)),
        layeringQuality: average(allScores.map((score) => score.components.layeringSilhouette)),
        occasionFormality: average(allScores.map((score) => score.components.occasionFormality)),
        preferenceMatch: average(allScores.map((score) => score.components.explicitPreference)),
        variety: average(allScores.map((score) => score.components.variety)),
        occasionTags: [...(bucket.occasionTags ?? [])],
        formalityLevel: formalityLevels.length ? Math.round(average(formalityLevels)) : null,
        warmthLevel: warmthLevels.length ? Math.round(average(warmthLevels)) : null,
        bucketKey: bucket.key,
      });
    }
  }

  const { selected } = selectBalancedOutfitPlans(proposals, items, {
    count: maxCandidates,
    maximumFoundationRepeats: Math.max(1, buckets.length),
  });

  return selected
    .map((proposal) => metadataByProposalId.get(proposal.id))
    .filter((candidate): candidate is GeneratedOutfitCandidate => candidate !== undefined);
}
