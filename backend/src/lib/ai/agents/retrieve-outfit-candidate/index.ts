import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe";
import type { OccasionContext } from "@/lib/recommendation";
import type { ClothingConstraints } from "@/lib/weather";
import { getHardFilterReasons, outfitCombinationKey } from "@/lib/recommendation";
import { scoreWardrobeCandidate } from "@/lib/recommendation";
import { OCCASION_CATEGORY_CONFIDENT_THRESHOLD } from "@/lib/recommendation";
import { createAdminClient } from "@/lib/supabase/admin";
import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import { resolveOccasionContext } from "@/lib/recommendation";
import { differsFromAll, outfitFoundationKey } from "@/lib/recommendation";
import { confidentOccasionTags } from "@/lib/recommendation";

// Below this, an LLM-composed outfit is more likely to serve the user well
// than the best available stored combination.
export const RETRIEVAL_MIN_SCORE = 0.55;

// A much wider prefiltered pool than a flat "top 25 by static score": live
// weather/occasion/exposure filtering runs across this whole pool instead of
// truncating before it gets a chance to apply.
export const RETRIEVAL_POOL_LIMIT = 150;

export const MAX_RESULTS = 3;

export const RECENT_SUGGESTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface RetrievalPreferenceContext {
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: readonly string[];
  dislikedItemIds?: readonly string[];
}

export interface RetrieveStoredOutfitInput {
  userId: string;
  occasionContext: OccasionContext;
  targetFormality?: number;
  weather?: ClothingConstraints;
  preferences?: RetrievalPreferenceContext;
}

export interface RetrievedOutfitCandidateItem {
  item_id: string;
  role: WardrobeItemRole;
  sort_order: number;
}

export type RetrievedOutfitSelectionReason = "safest" | "underused" | "expressive";

export type OutfitPreviewStatus = "none" | "queued" | "generating" | "ready" | "failed";

export interface RetrievedOutfitCandidate {
  candidateId: string;
  score: number;
  selectionReason: RetrievedOutfitSelectionReason;
  items: RetrievedOutfitCandidateItem[];
  resolvedItems: WardrobeItem[];
  styleTags: string[];
  previewStatus: OutfitPreviewStatus;
}

export interface EvaluatedCandidate {
  candidateId: string;
  score: number;
  preferenceMatch: number;
  timesSuggested: number;
  items: RetrievedOutfitCandidateItem[];
  resolvedItems: WardrobeItem[];
  combinationKey: string;
  curatorPreferred: boolean;
  styleTags: string[];
  previewBucket: string | null;
  previewStoragePath: string | null;
  previewStatus: OutfitPreviewStatus;
}

function scoreCandidateRow(
  row: Record<string, unknown>,
  resolvedItems: readonly WardrobeItem[],
  input: RetrieveStoredOutfitInput,
  requiredOccasionTags: readonly string[] | undefined,
): number {
  const perItemScores = resolvedItems.map(
    (item) =>
      scoreWardrobeCandidate(item, {
        weather: input.weather,
        occasionTags: requiredOccasionTags,
        targetFormality: input.targetFormality,
        preferences: input.preferences,
        selectedItems: resolvedItems.filter((candidate) => candidate.id !== item.id),
      }).total,
  );
  const liveScore = perItemScores.reduce((sum, value) => sum + value, 0) / perItemScores.length;

  const timesSuggested = (row.times_suggested as number | null) ?? 0;
  const lastSuggestedAt = row.last_suggested_at
    ? new Date(row.last_suggested_at as string).getTime()
    : null;
  const recentlySuggested =
    lastSuggestedAt !== null && Date.now() - lastSuggestedAt < RECENT_SUGGESTION_WINDOW_MS;
  const exposurePenalty = Math.min(0.3, timesSuggested * 0.05) + (recentlySuggested ? 0.2 : 0);
  return Math.max(0, Math.min(1, liveScore - exposurePenalty));
}

export function evaluateCandidateRow(
  row: Record<string, unknown>,
  itemsById: Map<string, WardrobeItem>,
  input: RetrieveStoredOutfitInput,
  requiredOccasionTags: readonly string[] | undefined,
): EvaluatedCandidate | null {
  const memberRows = (row.outfit_candidate_items ?? []) as RetrievedOutfitCandidateItem[];
  if (memberRows.length === 0) return null;

  const resolvedItems: WardrobeItem[] = [];
  for (const member of memberRows) {
    const item = itemsById.get(member.item_id);
    if (!item) return null;
    resolvedItems.push(item);
  }

  const hasHardConflict = resolvedItems.some(
    (item) =>
      getHardFilterReasons(item, {
        weather: input.weather,
        requiredOccasionTags,
      }).length > 0,
  );
  if (hasHardConflict) return null;

  return {
    candidateId: row.id as string,
    score: scoreCandidateRow(row, resolvedItems, input, requiredOccasionTags),
    preferenceMatch: (row.preference_match as number | null) ?? 0,
    timesSuggested: (row.times_suggested as number | null) ?? 0,
    items: memberRows,
    resolvedItems,
    combinationKey: outfitCombinationKey(memberRows.map((member) => member.item_id)),
    curatorPreferred: row.curator_status === "selected",
    styleTags: (row.style_tags as string[] | null) ?? [],
    previewBucket: (row.preview_bucket as string | null) ?? null,
    previewStoragePath: (row.preview_storage_path as string | null) ?? null,
    previewStatus: (row.preview_status as EvaluatedCandidate["previewStatus"]) ?? "none",
  };
}

function parseWardrobeRow(row: Record<string, unknown>): WardrobeItem {
  const keys = Object.keys(wardrobeItemSchema.shape);
  return wardrobeItemSchema.parse(Object.fromEntries(keys.map((key) => [key, row[key]])));
}

async function fetchResolvedItemsById(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  itemIds: readonly string[],
) {
  const { data: itemRows, error } = await admin
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("availability_status", "available")
    .is("deleted_at", null)
    .in("id", itemIds);
  if (error || !itemRows) return null;

  return new Map(
    itemRows.map((row) => [row.id as string, parseWardrobeRow(row as Record<string, unknown>)]),
  );
}

export async function fetchCandidatePool(input: RetrieveStoredOutfitInput) {
  const admin = createAdminClient();
  const { data: state } = await admin
    .from("wardrobe_compilation_state")
    .select("dirty_since, compiled_wardrobe_version")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!state || state.dirty_since || !state.compiled_wardrobe_version) return null;

  let query = admin
    .from("outfit_candidates")
    .select(
      "id, times_suggested, last_suggested_at, preference_match, curator_status, style_tags, preview_status, preview_bucket, preview_storage_path, outfit_candidate_items(item_id, role, sort_order)",
    )
    .eq("user_id", input.userId)
    .eq("status", "active")
    // Curator-rejected candidates stay in storage as an audit trail only --
    // never eligible for retrieval.
    .neq("curator_status", "rejected")
    .eq("compiled_wardrobe_version", state.compiled_wardrobe_version)
    .order("total_score", { ascending: false })
    .limit(RETRIEVAL_POOL_LIMIT);
  if (input.occasionContext.confidence >= OCCASION_CATEGORY_CONFIDENT_THRESHOLD) {
    query = query.contains("occasion_categories", [input.occasionContext.category]);
  }

  const { data: rows, error } = await query;
  if (error || !rows || rows.length === 0) return null;

  const allItemIds = [
    ...new Set(
      rows.flatMap((row) =>
        ((row.outfit_candidate_items ?? []) as RetrievedOutfitCandidateItem[]).map(
          (entry) => entry.item_id,
        ),
      ),
    ),
  ];
  if (allItemIds.length === 0) return null;

  const itemsById = await fetchResolvedItemsById(admin, input.userId, allItemIds);
  if (!itemsById) return null;

  return { rows, itemsById };
}

export async function markOutfitCandidateSuggested(userId: string, candidateId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("increment_outfit_candidate_exposure", {
    p_candidate_id: candidateId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export interface RecordFallbackOutfitCandidateInput {
  userId: string;
  occasion?: string | null;
  items: readonly { item_id: string; role: WardrobeItemRole; sort_order?: number }[];
}

/**
 * Opportunistically grows the library with an outfit the LLM had to compose
 * from scratch because nothing stored fit the request. The insert is now one
 * atomic RPC call (record_fallback_outfit_candidate) instead of two separate,
 * non-transactional inserts, so a failure can never leave an active candidate
 * with zero items. Best-effort: failures are swallowed so they can never
 * affect the user-facing response.
 */
export async function recordFallbackOutfitCandidate(input: RecordFallbackOutfitCandidateInput) {
  try {
    const admin = createAdminClient();
    const occasionContext = resolveOccasionContext(input.occasion);
    const combinationKey = outfitCombinationKey(input.items.map((item) => item.item_id));
    await admin.rpc("record_fallback_outfit_candidate", {
      p_user_id: input.userId,
      p_combination_key: combinationKey,
      p_occasion_category: occasionContext.category,
      p_occasion_tags: input.occasion ? [input.occasion] : [],
      p_items: input.items.map((item, index) => ({
        item_id: item.item_id,
        role: item.role,
        sort_order: item.sort_order ?? index,
      })),
    });
  } catch {
    // Never let library growth affect the user-facing generation response.
  }
}

type Selected = EvaluatedCandidate & { selectionReason: RetrievedOutfitSelectionReason };

function comparable(candidate: EvaluatedCandidate) {
  const itemIds = candidate.items.map((member) => member.item_id);
  return { itemIds, foundationKey: outfitFoundationKey(itemIds, candidate.resolvedItems) };
}

/**
 * Picks up to three qualifying candidates along three different axes — safest,
 * least-suggested, best preference match — and rejects any pick that is not
 * *meaningfully* different from the ones already chosen. A distinct
 * combination key was never enough on its own: swapping only the scarf
 * produced three near-identical looks wearing three different labels.
 */
export function selectDiverseCandidates(evaluated: readonly EvaluatedCandidate[]): Selected[] {
  const qualifying = evaluated
    .filter((candidate) => candidate.score >= RETRIEVAL_MIN_SCORE)
    .sort(
      (first, second) =>
        (second.curatorPreferred ? 1 : 0) - (first.curatorPreferred ? 1 : 0) ||
        second.score - first.score,
    );
  if (qualifying.length === 0) return [];

  const results: Selected[] = [];
  const chosen: ReturnType<typeof comparable>[] = [];

  function take(candidate: EvaluatedCandidate | undefined, reason: RetrievedOutfitSelectionReason) {
    if (!candidate || results.some((existing) => existing.candidateId === candidate.candidateId)) {
      return false;
    }
    const shape = comparable(candidate);
    if (!differsFromAll(shape, chosen)) return false;
    chosen.push(shape);
    results.push({ ...candidate, selectionReason: reason });
    return true;
  }

  take(qualifying[0], "safest");

  const byUnderused = [...qualifying].sort(
    (first, second) => first.timesSuggested - second.timesSuggested || second.score - first.score,
  );
  for (const candidate of byUnderused) {
    if (results.length >= MAX_RESULTS || take(candidate, "underused")) break;
  }

  const byPreference = [...qualifying].sort(
    (first, second) => second.preferenceMatch - first.preferenceMatch || second.score - first.score,
  );
  for (const candidate of byPreference) {
    if (results.length >= MAX_RESULTS || take(candidate, "expressive")) break;
  }

  return results.slice(0, MAX_RESULTS);
}

/**
 * Looks for precomputed outfit_candidates rows that fit this request instead
 * of asking the LLM to compose one from scratch. Returns up to 3 diverse,
 * quality-gated alternatives (safest, underused, expressive) ordered with the
 * safest pick first; an empty array means the caller should fall back to full
 * composition.
 */
export async function retrieveStoredOutfitCandidates(
  input: RetrieveStoredOutfitInput,
): Promise<RetrievedOutfitCandidate[]> {
  const pool = await fetchCandidatePool(input);
  if (!pool) return [];

  const requiredOccasionTags = confidentOccasionTags(input.occasionContext);
  const evaluated: EvaluatedCandidate[] = [];
  for (const row of pool.rows) {
    const candidate = evaluateCandidateRow(row, pool.itemsById, input, requiredOccasionTags);
    if (candidate) evaluated.push(candidate);
  }

  const selected = selectDiverseCandidates(evaluated);

  // Deliberately never signs a URL here: a signed URL is short-lived and this
  // result can end up persisted (stylist chat history), so callers that need
  // to display the image fetch a fresh signed URL on demand from
  // GET /api/outfit-candidates/[candidateId]/preview instead. "No preview
  // yet" is represented purely as previewStatus !== 'ready' -- never a
  // synchronous wait; this function makes zero curator or image-generation
  // calls, only reads already-persisted columns.
  return selected.map((candidate) => ({
    candidateId: candidate.candidateId,
    score: candidate.score,
    selectionReason: candidate.selectionReason,
    items: candidate.items,
    resolvedItems: candidate.resolvedItems,
    styleTags: candidate.styleTags,
    previewStatus: candidate.previewStatus,
  }));
}
