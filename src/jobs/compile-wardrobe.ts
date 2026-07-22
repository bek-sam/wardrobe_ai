import { randomUUID } from "node:crypto";

import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import type { WardrobeItem } from "@/features/wardrobe/types";
import {
  generateOutfitCandidates,
  type GeneratedOutfitCandidate,
} from "@/lib/compilation/generate-outfit-candidates";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type WardrobeCompilationJobRow = {
  id: string;
  user_id: string;
  status: string;
};

function parseWardrobeRow(row: Record<string, unknown>): WardrobeItem {
  const keys = Object.keys(wardrobeItemSchema.shape);
  return wardrobeItemSchema.parse(Object.fromEntries(keys.map((key) => [key, row[key]])));
}

async function loadJob(admin: AdminClient, jobId: string): Promise<WardrobeCompilationJobRow> {
  const { data, error } = await admin
    .from("wardrobe_compilation_jobs")
    .select("id, user_id, status")
    .eq("id", jobId)
    .single();
  if (error || !data) throw error ?? new Error("Wardrobe compilation job not found.");
  return data as WardrobeCompilationJobRow;
}

async function loadPreferenceContext(admin: AdminClient, userId: string) {
  const [{ data: style }, { data: feedbackRows }] = await Promise.all([
    admin
      .from("style_profiles")
      .select("favorite_colors, avoided_colors, preferred_fits")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("outfit_feedback")
      .select("outfit_id, feedback_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const outfitIds = [...new Set((feedbackRows ?? []).map((row) => row.outfit_id as string))];
  const { data: outfitItems } = outfitIds.length
    ? await admin
        .from("outfit_items")
        .select("outfit_id, item_id")
        .eq("user_id", userId)
        .in("outfit_id", outfitIds)
    : { data: [] as { outfit_id: string; item_id: string }[] };

  const itemIdsByOutfit = new Map<string, string[]>();
  for (const row of outfitItems ?? []) {
    const ids = itemIdsByOutfit.get(row.outfit_id) ?? [];
    ids.push(row.item_id);
    itemIdsByOutfit.set(row.outfit_id, ids);
  }

  const likedEvidence = new Map<string, number>();
  const dislikedEvidence = new Map<string, number>();
  for (const row of feedbackRows ?? []) {
    const evidence =
      row.feedback_type === "like" ? likedEvidence : row.feedback_type === "dislike" ? dislikedEvidence : null;
    if (!evidence) continue;
    for (const itemId of itemIdsByOutfit.get(row.outfit_id) ?? []) {
      evidence.set(itemId, (evidence.get(itemId) ?? 0) + 1);
    }
  }
  const repeatedIds = (evidence: Map<string, number>) =>
    [...evidence].filter(([, count]) => count >= 2).map(([itemId]) => itemId);

  return {
    favoriteColors: (style?.favorite_colors ?? []) as string[],
    avoidedColors: (style?.avoided_colors ?? []) as string[],
    preferredFits: (style?.preferred_fits ?? []) as string[],
    likedItemIds: repeatedIds(likedEvidence),
    dislikedItemIds: repeatedIds(dislikedEvidence),
  };
}

async function writeCandidates(
  admin: AdminClient,
  userId: string,
  jobId: string,
  compiledWardrobeVersion: string,
  candidates: readonly GeneratedOutfitCandidate[],
) {
  const { error: deleteError } = await admin.from("outfit_candidates").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
  if (candidates.length === 0) return;

  const { data: insertedCandidates, error: insertCandidatesError } = await admin
    .from("outfit_candidates")
    .insert(
      candidates.map((candidate) => ({
        user_id: userId,
        combination_key: candidate.combinationKey,
        compiled_wardrobe_version: compiledWardrobeVersion,
        job_id: jobId,
        occasion_tags: candidate.occasionTags,
        formality_level: candidate.formalityLevel,
        warmth_level: candidate.warmthLevel,
        color_harmony: candidate.colorHarmony,
        layering_quality: candidate.layeringQuality,
        occasion_formality: candidate.occasionFormality,
        preference_match: candidate.preferenceMatch,
        variety: candidate.variety,
        total_score: candidate.totalScore,
      })),
    )
    .select("id, combination_key");
  if (insertCandidatesError) throw insertCandidatesError;

  const candidateIdByCombinationKey = new Map(
    (insertedCandidates ?? []).map((row) => [row.combination_key as string, row.id as string]),
  );
  const candidateItemRows = candidates.flatMap((candidate) => {
    const candidateId = candidateIdByCombinationKey.get(candidate.combinationKey);
    if (!candidateId) return [];
    return candidate.items.map((item) => ({
      candidate_id: candidateId,
      item_id: item.itemId,
      user_id: userId,
      role: item.role,
      sort_order: item.sortOrder,
    }));
  });
  if (candidateItemRows.length === 0) return;

  const { error: insertItemsError } = await admin.from("outfit_candidate_items").insert(candidateItemRows);
  if (insertItemsError) throw insertItemsError;
}

export async function compileWardrobeForUser(userId: string, jobId: string) {
  const admin = createAdminClient();
  const job = await loadJob(admin, jobId);
  if (job.user_id !== userId) {
    throw new Error("Wardrobe compilation job does not belong to this user.");
  }

  try {
    const [{ data: initialState }, { data: itemRows, error: itemsError }, preferences] = await Promise.all([
      admin
        .from("wardrobe_compilation_state")
        .select("pending_change_count")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("wardrobe_items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("availability_status", "available")
        .is("deleted_at", null)
        .limit(500),
      loadPreferenceContext(admin, userId),
    ]);
    if (itemsError) throw itemsError;
    const startChangeCount = (initialState?.pending_change_count as number | undefined) ?? 0;

    const items = (itemRows ?? []).map((row) => parseWardrobeRow(row as Record<string, unknown>));
    const candidates = generateOutfitCandidates(items, { preferences });
    const compiledWardrobeVersion = randomUUID();

    await writeCandidates(admin, userId, jobId, compiledWardrobeVersion, candidates);

    const { data: latestState } = await admin
      .from("wardrobe_compilation_state")
      .select("pending_change_count")
      .eq("user_id", userId)
      .maybeSingle();
    const changedDuringRun =
      ((latestState?.pending_change_count as number | undefined) ?? 0) > startChangeCount;

    await admin.from("wardrobe_compilation_state").upsert(
      {
        user_id: userId,
        last_compiled_at: new Date().toISOString(),
        compiled_wardrobe_version: compiledWardrobeVersion,
        candidate_count: candidates.length,
        scoring_model_version: "v1",
        ...(changedDuringRun ? {} : { dirty_since: null }),
      },
      { onConflict: "user_id" },
    );

    await admin
      .from("wardrobe_compilation_jobs")
      .update({
        status: "complete",
        items_considered: items.length,
        candidates_generated: candidates.length,
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_until: null,
        next_attempt_at: null,
        error_code: null,
        error_message: null,
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (changedDuringRun) {
      // Best-effort follow-up: the debounce slot just freed above, so this
      // insert should succeed. If it races with the trigger's own insert and
      // hits the unique index, that's fine — one queued job is all we need.
      try {
        await admin
          .from("wardrobe_compilation_jobs")
          .insert({ user_id: userId, status: "queued", trigger_reason: "item_change" });
      } catch {
        // Ignored: a duplicate queued row means the work is already covered.
      }
    }

    return {
      jobId,
      status: "complete" as const,
      candidatesGenerated: candidates.length,
      itemsConsidered: items.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown wardrobe compilation error";
    await admin
      .from("wardrobe_compilation_jobs")
      .update({
        status: "failed",
        error_code: "compilation_failed",
        error_message: message,
        locked_at: null,
        locked_until: null,
        next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
      })
      .eq("id", jobId)
      .eq("user_id", userId);
    throw error;
  }
}
