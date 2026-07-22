import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import { getHardFilterReasons, outfitCombinationKey, scoreWardrobeCandidate } from "@/lib/recommendation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClothingConstraints } from "@/lib/weather";

export interface RetrievalPreferenceContext {
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: readonly string[];
  dislikedItemIds?: readonly string[];
}

export interface RetrieveStoredOutfitInput {
  userId: string;
  occasion?: string | null;
  targetFormality?: number;
  weather?: ClothingConstraints;
  preferences?: RetrievalPreferenceContext;
}

export interface RetrievedOutfitCandidateItem {
  item_id: string;
  role: WardrobeItemRole;
  sort_order: number;
}

export interface RetrievedOutfitCandidate {
  candidateId: string;
  score: number;
  items: RetrievedOutfitCandidateItem[];
  resolvedItems: WardrobeItem[];
}

// Below this, an LLM-composed outfit is more likely to serve the user well
// than the best available stored combination.
const RETRIEVAL_MIN_SCORE = 0.55;
const RETRIEVAL_POOL_LIMIT = 25;
const RECENT_SUGGESTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function parseWardrobeRow(row: Record<string, unknown>): WardrobeItem {
  const keys = Object.keys(wardrobeItemSchema.shape);
  return wardrobeItemSchema.parse(Object.fromEntries(keys.map((key) => [key, row[key]])));
}

/**
 * Looks for a precomputed outfit_candidates row that fits this request instead
 * of asking the LLM to compose one from scratch. Returns null whenever the
 * library is missing, stale, or nothing in it clears the quality bar — the
 * caller should fall back to full composition in that case.
 */
export async function retrieveStoredOutfitCandidate(
  input: RetrieveStoredOutfitInput,
): Promise<RetrievedOutfitCandidate | null> {
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
      "id, times_suggested, last_suggested_at, outfit_candidate_items(item_id, role, sort_order)",
    )
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("compiled_wardrobe_version", state.compiled_wardrobe_version)
    .order("total_score", { ascending: false })
    .limit(RETRIEVAL_POOL_LIMIT);
  if (input.occasion) query = query.contains("occasion_tags", [input.occasion]);

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

  const { data: itemRows, error: itemsError } = await admin
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("availability_status", "available")
    .is("deleted_at", null)
    .in("id", allItemIds);
  if (itemsError || !itemRows) return null;

  const itemsById = new Map(
    itemRows.map((row) => [row.id as string, parseWardrobeRow(row as Record<string, unknown>)]),
  );

  let best: RetrievedOutfitCandidate | null = null;
  for (const row of rows) {
    const memberRows = (row.outfit_candidate_items ?? []) as RetrievedOutfitCandidateItem[];
    if (memberRows.length === 0) continue;

    const resolvedItems: WardrobeItem[] = [];
    let allAvailable = true;
    for (const member of memberRows) {
      const item = itemsById.get(member.item_id);
      if (!item) {
        allAvailable = false;
        break;
      }
      resolvedItems.push(item);
    }
    if (!allAvailable) continue;

    const hasHardConflict = resolvedItems.some(
      (item) =>
        getHardFilterReasons(item, {
          weather: input.weather,
          requiredOccasionTags: input.occasion ? [input.occasion] : undefined,
        }).length > 0,
    );
    if (hasHardConflict) continue;

    const perItemScores = resolvedItems.map(
      (item) =>
        scoreWardrobeCandidate(item, {
          weather: input.weather,
          occasionTags: input.occasion ? [input.occasion] : undefined,
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
    const finalScore = Math.max(0, Math.min(1, liveScore - exposurePenalty));

    if (!best || finalScore > best.score) {
      best = {
        candidateId: row.id as string,
        score: finalScore,
        items: memberRows,
        resolvedItems,
      };
    }
  }

  if (!best || best.score < RETRIEVAL_MIN_SCORE) return null;
  return best;
}

export async function markOutfitCandidateSuggested(userId: string, candidateId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("outfit_candidates")
    .select("times_suggested")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .maybeSingle();
  await admin
    .from("outfit_candidates")
    .update({
      times_suggested: ((data?.times_suggested as number | null) ?? 0) + 1,
      last_suggested_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .eq("user_id", userId);
}

export interface RecordFallbackOutfitCandidateInput {
  userId: string;
  occasion?: string | null;
  items: readonly { item_id: string; role: WardrobeItemRole; sort_order?: number }[];
}

/**
 * Opportunistically grows the library with an outfit the LLM had to compose
 * from scratch because nothing stored fit the request. Best-effort: failures
 * (including "this combination is already in the library") are swallowed so
 * they can never affect the user-facing response.
 */
export async function recordFallbackOutfitCandidate(input: RecordFallbackOutfitCandidateInput) {
  try {
    const admin = createAdminClient();
    const { data: state } = await admin
      .from("wardrobe_compilation_state")
      .select("dirty_since, compiled_wardrobe_version")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!state?.compiled_wardrobe_version || state.dirty_since) return;

    const combinationKey = outfitCombinationKey(input.items.map((item) => item.item_id));
    const { data: inserted, error } = await admin
      .from("outfit_candidates")
      .insert({
        user_id: input.userId,
        combination_key: combinationKey,
        compiled_wardrobe_version: state.compiled_wardrobe_version,
        status: "active",
        generated_by: "fallback_llm",
        occasion_tags: input.occasion ? [input.occasion] : [],
        total_score: 0.6,
      })
      .select("id")
      .maybeSingle();
    if (error || !inserted) return;

    await admin.from("outfit_candidate_items").insert(
      input.items.map((item, index) => ({
        candidate_id: inserted.id,
        item_id: item.item_id,
        user_id: input.userId,
        role: item.role,
        sort_order: item.sort_order ?? index,
      })),
    );
  } catch {
    // Never let library growth affect the user-facing generation response.
  }
}
