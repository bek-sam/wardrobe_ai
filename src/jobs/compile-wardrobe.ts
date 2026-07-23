import { randomUUID } from "node:crypto";

import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import {
  computeAnalysisHash,
  getCachedAnalysis,
  writeCachedAnalysis,
} from "@/lib/ai/agents/outfit-analysis-cache";
import {
  runOutfitCuratorAgent,
  type CuratorCandidateInput,
} from "@/lib/ai/agents/outfit-curator-agent";
import { OUTFIT_CURATOR_PROMPT_VERSION } from "@/lib/ai/prompts/outfit-curator";
import type { CuratorCandidateDecision } from "@/lib/ai/schemas/outfit-curator";
import { buildCuratorContext } from "@/lib/compilation/build-curator-context";
import {
  generateOutfitCandidates,
  type GeneratedOutfitCandidate,
} from "@/lib/compilation/generate-outfit-candidates";
import { getServerEnvironment } from "@/lib/env/server";
import { STYLE_KNOWLEDGE_VERSION } from "@/lib/style-knowledge";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

type WardrobeCompilationJobRow = {
  id: string;
  user_id: string;
  status: string;
  attempt_count: number;
};

// Mirrors retryAt() in process-storage-deletions.ts: capped exponential
// backoff so a transiently-failing job (provider hiccup, DB contention)
// doesn't get re-claimed and retried in a tight loop.
function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}

function parseWardrobeRow(row: Record<string, unknown>): WardrobeItem {
  const keys = Object.keys(wardrobeItemSchema.shape);
  return wardrobeItemSchema.parse(Object.fromEntries(keys.map((key) => [key, row[key]])));
}

async function loadJob(admin: AdminClient, jobId: string): Promise<WardrobeCompilationJobRow> {
  const { data, error } = await admin
    .from("wardrobe_compilation_jobs")
    .select("id, user_id, status, attempt_count")
    .eq("id", jobId)
    .single();
  if (error || !data) throw error ?? new Error("Wardrobe compilation job not found.");
  return data as WardrobeCompilationJobRow;
}

async function loadPreferenceContext(admin: AdminClient, userId: string) {
  const [{ data: style }, { data: feedbackRows }] = await Promise.all([
    admin
      .from("style_profiles")
      .select(
        "favorite_colors, avoided_colors, preferred_fits, style_keywords, style_archetypes, updated_at",
      )
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
      row.feedback_type === "like"
        ? likedEvidence
        : row.feedback_type === "dislike"
          ? dislikedEvidence
          : null;
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
    styleKeywords: (style?.style_keywords ?? []) as string[],
    styleArchetypes: (style?.style_archetypes ?? []) as string[],
    preferenceVersion: (style?.updated_at as string | undefined) ?? "none",
    likedItemIds: repeatedIds(likedEvidence),
    dislikedItemIds: repeatedIds(dislikedEvidence),
  };
}

type PreferenceContext = Awaited<ReturnType<typeof loadPreferenceContext>>;

interface ChangeEventSummary {
  eventIds: string[];
  createdItemIds: Set<string>;
  deletedItemIds: Set<string>;
  changedItemIds: Set<string>;
  hasPreferenceChange: boolean;
  affectedItemIds: Set<string>;
}

// Reads every unprocessed wardrobe_change_events row for this user (populated
// by the triggers in migration 202607220001) to decide which candidates
// actually need fresh curator attention this run, instead of treating every
// compile as "everything changed."
async function loadChangeEvents(admin: AdminClient, userId: string): Promise<ChangeEventSummary> {
  const { data } = await admin
    .from("wardrobe_change_events")
    .select("id, item_id, change_type")
    .eq("user_id", userId)
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(2000);
  const rows = data ?? [];

  const createdItemIds = new Set<string>();
  const deletedItemIds = new Set<string>();
  const changedItemIds = new Set<string>();
  let hasPreferenceChange = false;

  for (const row of rows) {
    const itemId = row.item_id as string | null;
    const changeType = row.change_type as string;
    if (changeType === "preference_changed") {
      hasPreferenceChange = true;
    } else if (itemId && changeType === "created") {
      createdItemIds.add(itemId);
    } else if (itemId && changeType === "deleted") {
      deletedItemIds.add(itemId);
    } else if (
      itemId &&
      (changeType === "metadata_changed" ||
        changeType === "availability_changed" ||
        changeType === "cutout_changed")
    ) {
      changedItemIds.add(itemId);
    }
  }

  return {
    eventIds: rows.map((row) => row.id as string),
    createdItemIds,
    deletedItemIds,
    changedItemIds,
    hasPreferenceChange,
    affectedItemIds: new Set([...createdItemIds, ...changedItemIds, ...deletedItemIds]),
  };
}

// Fields carried forward from an unaffected candidate's row in the
// previously published version, so previews/curator analysis survive an
// unrelated wardrobe edit instead of resetting to not_reviewed/none every
// compile.
const REUSABLE_CANDIDATE_COLUMNS =
  "combination_key, curator_status, curator_rejection_reason, curator_confidence, curator_rank, " +
  "curator_model, curator_prompt_version, curator_reviewed_at, style_tags, preview_status, " +
  "preview_bucket, preview_storage_path, preview_source_hash, preview_model, preview_generated_at, " +
  "preview_error_code, times_suggested, last_suggested_at";

interface ReusableCandidateFields {
  curator_status: string;
  curator_rejection_reason: string | null;
  curator_confidence: number | null;
  curator_rank: number | null;
  curator_model: string | null;
  curator_prompt_version: string | null;
  curator_reviewed_at: string | null;
  style_tags: string[];
  preview_status: string;
  preview_bucket: string | null;
  preview_storage_path: string | null;
  preview_source_hash: string | null;
  preview_model: string | null;
  preview_generated_at: string | null;
  preview_error_code: string | null;
  times_suggested: number;
  last_suggested_at: string | null;
}

type ReusableCandidateRow = ReusableCandidateFields & { combination_key: string };

// Versioned publish: inserts the new version's rows as genuinely new rows
// (never a delete-then-insert, and never a same-combination-key update onto a
// row belonging to a different version -- the unique constraint is scoped to
// (user_id, compiled_wardrobe_version, combination_key) precisely so this
// insert can't collide across versions). finalize_wardrobe_compilation() is
// the only thing that flips the published-version pointer, after verifying
// this count, so a crash mid-write here just leaves inert unpublished rows.
async function writeCandidates(
  admin: AdminClient,
  userId: string,
  jobId: string,
  compiledWardrobeVersion: string,
  previousVersion: string | null,
  affectedItemIds: ReadonlySet<string>,
  candidates: readonly GeneratedOutfitCandidate[],
): Promise<Map<string, string>> {
  if (candidates.length === 0) return new Map();

  const reusableByCombinationKey = new Map<string, ReusableCandidateFields>();
  if (previousVersion) {
    const unaffectedKeys = candidates
      .filter((candidate) => !candidate.items.some((item) => affectedItemIds.has(item.itemId)))
      .map((candidate) => candidate.combinationKey);
    if (unaffectedKeys.length > 0) {
      const { data: previousRows } = await admin
        .from("outfit_candidates")
        .select(REUSABLE_CANDIDATE_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("compiled_wardrobe_version", previousVersion)
        .in("combination_key", unaffectedKeys);
      for (const row of (previousRows ?? []) as unknown as ReusableCandidateRow[]) {
        reusableByCombinationKey.set(row.combination_key, {
          curator_status: row.curator_status,
          curator_rejection_reason: row.curator_rejection_reason,
          curator_confidence: row.curator_confidence,
          curator_rank: row.curator_rank,
          curator_model: row.curator_model,
          curator_prompt_version: row.curator_prompt_version,
          curator_reviewed_at: row.curator_reviewed_at,
          style_tags: row.style_tags,
          preview_status: row.preview_status,
          preview_bucket: row.preview_bucket,
          preview_storage_path: row.preview_storage_path,
          preview_source_hash: row.preview_source_hash,
          preview_model: row.preview_model,
          preview_generated_at: row.preview_generated_at,
          preview_error_code: row.preview_error_code,
          times_suggested: row.times_suggested,
          last_suggested_at: row.last_suggested_at,
        });
      }
    }
  }

  const { data: upsertedCandidates, error: upsertCandidatesError } = await admin
    .from("outfit_candidates")
    .upsert(
      candidates.map((candidate) => ({
        user_id: userId,
        combination_key: candidate.combinationKey,
        compiled_wardrobe_version: compiledWardrobeVersion,
        job_id: jobId,
        occasion_tags: candidate.occasionTags,
        occasion_category: candidate.occasionCategory,
        weather_tags: candidate.weatherTags,
        formality_level: candidate.formalityLevel,
        warmth_level: candidate.warmthLevel,
        color_harmony: candidate.colorHarmony,
        layering_quality: candidate.layeringQuality,
        occasion_formality: candidate.occasionFormality,
        preference_match: candidate.preferenceMatch,
        variety: candidate.variety,
        total_score: candidate.totalScore,
        ...reusableByCombinationKey.get(candidate.combinationKey),
      })),
      { onConflict: "user_id,compiled_wardrobe_version,combination_key" },
    )
    .select("id, combination_key");
  if (upsertCandidatesError) throw upsertCandidatesError;

  const candidateIdByCombinationKey = new Map(
    (upsertedCandidates ?? []).map((row) => [row.combination_key as string, row.id as string]),
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
  if (candidateItemRows.length > 0) {
    const { error: upsertItemsError } = await admin
      .from("outfit_candidate_items")
      .upsert(candidateItemRows, { onConflict: "candidate_id,item_id" });
    if (upsertItemsError) throw upsertItemsError;
  }

  return candidateIdByCombinationKey;
}

async function discardUnpublishedVersion(
  admin: AdminClient,
  userId: string,
  compiledWardrobeVersion: string,
) {
  // Best-effort cleanup of a version that failed before finalize() could
  // publish it. Never referenced by wardrobe_compilation_state, so leaving it
  // behind would only ever waste space, not serve stale/wrong data -- but
  // clean it up anyway so failed attempts don't accumulate.
  await admin
    .from("outfit_candidates")
    .delete()
    .eq("user_id", userId)
    .eq("compiled_wardrobe_version", compiledWardrobeVersion);
}

type CuratorCandidateRow = {
  id: string;
  combination_key: string;
  occasion_category: string | null;
  curator_status: string;
  created_at: string;
  total_score: number;
  formality_level: number | null;
  warmth_level: number | null;
  color_harmony: number | null;
  layering_quality: number | null;
  occasion_formality: number | null;
  preference_match: number | null;
  variety: number | null;
  weather_tags: string[] | null;
  outfit_candidate_items: { item_id: string; role: WardrobeItemRole }[] | null;
};

function toGeneratedCandidate(row: CuratorCandidateRow): GeneratedOutfitCandidate {
  const memberRows = row.outfit_candidate_items ?? [];
  return {
    combinationKey: row.combination_key,
    items: memberRows.map((member, index) => ({
      itemId: member.item_id,
      role: member.role,
      sortOrder: index,
    })),
    totalScore: row.total_score,
    colorHarmony: row.color_harmony ?? 0,
    layeringQuality: row.layering_quality ?? 0,
    occasionFormality: row.occasion_formality ?? 0,
    preferenceMatch: row.preference_match ?? 0,
    variety: row.variety ?? 0,
    occasionTags: [],
    occasionCategory: (row.occasion_category ??
      "casual") as GeneratedOutfitCandidate["occasionCategory"],
    weatherTags: row.weather_tags ?? [],
    formalityLevel: row.formality_level,
    warmthLevel: row.warmth_level,
    bucketKey: row.occasion_category ?? "casual",
  };
}

// Applies each decision as its own scoped update (not a bulk upsert): the
// per-row values genuinely differ, and an upsert without every NOT NULL
// column supplied risks Postgres validating the phantom insert branch. Each
// update is scoped by id + user_id, and every id here always came from this
// user's own just-queried candidate rows, so there is no cross-user risk.
async function applyCuratorDecisions(
  admin: AdminClient,
  userId: string,
  decisions: readonly CuratorCandidateDecision[],
  curatorModel: string,
) {
  await Promise.all(
    decisions.map((decision) =>
      admin
        .from("outfit_candidates")
        .update({
          curator_status: decision.decision === "select" ? "selected" : "rejected",
          curator_rejection_reason: decision.rejectionReason,
          curator_confidence: decision.confidence,
          curator_rank: decision.decision === "select" ? decision.rankAmongNewItemOutfits : null,
          curator_model: curatorModel,
          curator_prompt_version: OUTFIT_CURATOR_PROMPT_VERSION,
          curator_reviewed_at: new Date().toISOString(),
          style_tags: decision.decision === "select" ? decision.aestheticTags : [],
          occasion_category: decision.occasionCategory,
        })
        .eq("id", decision.candidateId)
        .eq("user_id", userId)
        .eq("status", "active"),
    ),
  );
}

// Enforces WARDROBE_CURATOR_MAX_SELECTED_PER_NEW_ITEM: beyond the cap, the
// lowest-ranked extras are downgraded back to 'not_reviewed' -- never
// 'rejected', since they weren't judged awkward, just not chosen this round.
async function enforceMaxSelectedPerNewItem(
  admin: AdminClient,
  userId: string,
  createdItemIds: ReadonlySet<string>,
  maxSelectedPerNewItem: number,
) {
  for (const itemId of createdItemIds) {
    const { data: memberRows } = await admin
      .from("outfit_candidate_items")
      .select("candidate_id")
      .eq("user_id", userId)
      .eq("item_id", itemId);
    const candidateIds = [...new Set((memberRows ?? []).map((row) => row.candidate_id as string))];
    if (candidateIds.length === 0) continue;

    const { data: selectedRows } = await admin
      .from("outfit_candidates")
      .select("id, curator_rank")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("curator_status", "selected")
      .in("id", candidateIds);
    const rows = selectedRows ?? [];
    if (rows.length <= maxSelectedPerNewItem) continue;

    const sorted = [...rows].sort(
      (first, second) =>
        ((first.curator_rank as number | null) ?? 999) -
        ((second.curator_rank as number | null) ?? 999),
    );
    const excess = sorted.slice(maxSelectedPerNewItem);
    await Promise.all(
      excess.map((row) =>
        admin
          .from("outfit_candidates")
          .update({ curator_status: "not_reviewed", curator_rank: null })
          .eq("id", row.id as string)
          .eq("user_id", userId),
      ),
    );
  }
}

// Bounded, cache-aware curator pass: at most environment.WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION
// model calls regardless of how many wardrobe items changed this run. Reads
// candidates directly from the just-published (or, on the no-op path,
// already-published) version so it works identically either way. Any
// failure inside this function is caught by the caller -- candidates simply
// keep curator_status='not_reviewed' and the deterministic library remains
// fully usable; the next compile's "catch-up" shortlist retries them.
async function runCuratorPass(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  preferences: PreferenceContext,
  compiledWardrobeVersion: string,
  affectedItemIds: ReadonlySet<string>,
  createdItemIds: ReadonlySet<string>,
): Promise<{ calls: number }> {
  const maxCandidatesPerCall = environment.WARDROBE_CURATOR_MAX_CANDIDATES;
  const maxCalls = environment.WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION;

  const { data: candidateRows } = await admin
    .from("outfit_candidates")
    .select(
      "id, combination_key, occasion_category, curator_status, created_at, total_score, formality_level, " +
        "warmth_level, color_harmony, layering_quality, occasion_formality, preference_match, variety, " +
        "weather_tags, outfit_candidate_items(item_id, role)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("compiled_wardrobe_version", compiledWardrobeVersion)
    .order("total_score", { ascending: false })
    .limit(2000);
  const rows = (candidateRows ?? []) as unknown as CuratorCandidateRow[];
  if (rows.length === 0) return { calls: 0 };

  const allItemIds = [
    ...new Set(rows.flatMap((row) => (row.outfit_candidate_items ?? []).map((m) => m.item_id))),
  ];
  const { data: itemRows } = allItemIds.length
    ? await admin.from("wardrobe_items").select("*").eq("user_id", userId).in("id", allItemIds)
    : { data: [] as Record<string, unknown>[] };
  const itemsById = new Map(
    (itemRows ?? []).map((row) => [
      row.id as string,
      parseWardrobeRow(row as Record<string, unknown>),
    ]),
  );

  function resolveItems(row: CuratorCandidateRow): WardrobeItem[] | null {
    const memberRows = row.outfit_candidate_items ?? [];
    const resolved = memberRows.map((member) => itemsById.get(member.item_id));
    if (resolved.some((item) => item === undefined)) return null;
    return resolved as WardrobeItem[];
  }

  const containsAffectedItem = (row: CuratorCandidateRow) =>
    (row.outfit_candidate_items ?? []).some((member) => affectedItemIds.has(member.item_id));

  const perOccasionCount = new Map<string, number>();
  const shortlistA = rows
    .filter(containsAffectedItem)
    .filter((row) => {
      const key = row.occasion_category ?? "casual";
      const count = perOccasionCount.get(key) ?? 0;
      if (count >= 6) return false;
      perOccasionCount.set(key, count + 1);
      return true;
    })
    .slice(0, maxCandidatesPerCall);
  const usedIds = new Set(shortlistA.map((row) => row.id));

  let callsMade = 0;

  async function processShortlist(shortlistRows: readonly CuratorCandidateRow[]) {
    if (shortlistRows.length === 0 || callsMade >= maxCalls || !environment.OPENAI_CURATOR_MODEL)
      return;

    const contexts: CuratorCandidateInput[] = [];
    const hashByCandidateId = new Map<string, string>();
    const candidateKeyById = new Map<string, string>();
    const cacheHitDecisions: CuratorCandidateDecision[] = [];

    for (const row of shortlistRows) {
      const resolvedItems = resolveItems(row);
      if (!resolvedItems) continue;
      candidateKeyById.set(row.id, row.combination_key);

      const hash = computeAnalysisHash({
        itemIds: resolvedItems.map((item) => item.id),
        itemMetadataVersions: Object.fromEntries(
          resolvedItems.map((item) => [item.id, item.updated_at]),
        ),
        preferenceVersion: preferences.preferenceVersion,
        styleKnowledgeVersion: STYLE_KNOWLEDGE_VERSION,
        curatorModel: environment.OPENAI_CURATOR_MODEL,
        curatorPromptVersion: OUTFIT_CURATOR_PROMPT_VERSION,
      });
      hashByCandidateId.set(row.id, hash);

      const cached = await getCachedAnalysis(admin, userId, hash);
      if (cached) {
        cacheHitDecisions.push({ ...cached, candidateId: row.id });
      } else {
        contexts.push(
          buildCuratorContext(row.id, toGeneratedCandidate(row), resolvedItems, createdItemIds),
        );
      }
    }

    if (cacheHitDecisions.length > 0) {
      await applyCuratorDecisions(
        admin,
        userId,
        cacheHitDecisions,
        environment.OPENAI_CURATOR_MODEL,
      );
    }
    if (contexts.length === 0 || callsMade >= maxCalls) return;

    const { data: quota } = await admin.rpc("service_check_and_increment_usage_window", {
      p_user_id: userId,
      p_feature: "outfit_curator_calls",
      p_limit: environment.DAILY_CURATOR_CALL_LIMIT,
      p_period: "day",
      p_increment: 1,
    });
    if (!(quota as { allowed?: boolean } | null)?.allowed) return;

    callsMade += 1;
    const agentResult = await runOutfitCuratorAgent({
      userId,
      candidates: contexts,
      userPreferences: {
        styleKeywords: preferences.styleKeywords,
        styleArchetypes: preferences.styleArchetypes,
        favoriteColors: preferences.favoriteColors,
        avoidedColors: preferences.avoidedColors,
      },
      knowledgeVersion: STYLE_KNOWLEDGE_VERSION,
    });

    await applyCuratorDecisions(admin, userId, agentResult.result.decisions, agentResult.model);

    await Promise.all(
      agentResult.result.decisions.map((decision) =>
        writeCachedAnalysis(admin, {
          userId,
          hash: hashByCandidateId.get(decision.candidateId) ?? decision.candidateId,
          candidateKey: candidateKeyById.get(decision.candidateId) ?? decision.candidateId,
          model: agentResult.model,
          promptVersion: agentResult.promptVersion,
          knowledgeVersion: STYLE_KNOWLEDGE_VERSION,
          decision,
          ttlDays: environment.OUTFIT_ANALYSIS_CACHE_TTL_DAYS,
        }),
      ),
    );
  }

  await processShortlist(shortlistA);

  if (callsMade < maxCalls) {
    const shortlistB = [...rows]
      .filter((row) => row.curator_status === "not_reviewed" && !usedIds.has(row.id))
      .sort(
        (first, second) =>
          new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
      )
      .slice(0, maxCandidatesPerCall);
    await processShortlist(shortlistB);
  }

  if (createdItemIds.size > 0) {
    await enforceMaxSelectedPerNewItem(
      admin,
      userId,
      createdItemIds,
      environment.WARDROBE_CURATOR_MAX_SELECTED_PER_NEW_ITEM,
    );
  }

  return { calls: callsMade };
}

// Best-effort auto-preview enqueue (Rule 1: top 3-5 candidates featuring a
// newly added garment). Gated on modeled_preview_consent; never throws.
async function enqueueAutomaticPreviewJobs(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  createdItemIds: ReadonlySet<string>,
  compiledWardrobeVersion: string,
) {
  if (createdItemIds.size === 0) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("modeled_preview_consent")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.modeled_preview_consent) return;

  const { data: memberRows } = await admin
    .from("outfit_candidate_items")
    .select("candidate_id")
    .eq("user_id", userId)
    .in("item_id", [...createdItemIds]);
  const candidateIds = [...new Set((memberRows ?? []).map((row) => row.candidate_id as string))];
  if (candidateIds.length === 0) return;

  const { data: candidateRows } = await admin
    .from("outfit_candidates")
    .select("id, preview_status")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("compiled_wardrobe_version", compiledWardrobeVersion)
    .in("id", candidateIds)
    .order("total_score", { ascending: false })
    .limit(environment.PREVIEW_MAX_AUTO_PER_UPLOAD);

  await Promise.all(
    (candidateRows ?? [])
      .filter((row) => row.preview_status !== "ready")
      .map((row) =>
        admin
          .rpc("enqueue_outfit_preview_job", {
            p_user_id: userId,
            p_candidate_id: row.id,
            p_priority_reason: "new_item",
            p_max_queued_per_user: environment.PREVIEW_MAX_QUEUED_PER_USER,
          })
          .then(
            () => undefined,
            () => undefined,
          ),
      ),
  );
}

export async function compileWardrobeForUser(userId: string, jobId: string) {
  const admin = createAdminClient();
  const job = await loadJob(admin, jobId);
  if (job.user_id !== userId) {
    throw new Error("Wardrobe compilation job does not belong to this user.");
  }

  let compiledWardrobeVersion: string = randomUUID();
  let isNewVersion = true;
  try {
    const [
      { data: initialState },
      { data: itemRows, error: itemsError },
      preferences,
      changeEvents,
    ] = await Promise.all([
      admin
        .from("wardrobe_compilation_state")
        .select("pending_change_count, compiled_wardrobe_version, candidate_count")
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
      loadChangeEvents(admin, userId),
    ]);
    if (itemsError) throw itemsError;
    const startChangeCount = (initialState?.pending_change_count as number | undefined) ?? 0;

    const items = (itemRows ?? []).map((row) => parseWardrobeRow(row as Record<string, unknown>));
    const environment = getServerEnvironment();

    const isNoOp =
      changeEvents.affectedItemIds.size === 0 &&
      !changeEvents.hasPreferenceChange &&
      Boolean(initialState?.compiled_wardrobe_version);

    let candidateCount: number;
    if (isNoOp) {
      // Nothing changed since the last publish: republish the current
      // version as-is (zero new candidate/candidate-item writes) instead of
      // regenerating and re-upserting an unaffected library.
      compiledWardrobeVersion = initialState!.compiled_wardrobe_version as string;
      isNewVersion = false;
      candidateCount = (initialState?.candidate_count as number | undefined) ?? 0;
    } else {
      const candidates = generateOutfitCandidates(items, {
        preferences,
        maxCandidates: environment.WARDROBE_COMPILATION_MAX_CANDIDATES,
        maxFoundationsPerBucket: environment.WARDROBE_COMPILATION_MAX_FOUNDATIONS_PER_BUCKET,
      });
      await writeCandidates(
        admin,
        userId,
        jobId,
        compiledWardrobeVersion,
        (initialState?.compiled_wardrobe_version as string | undefined) ?? null,
        changeEvents.affectedItemIds,
        candidates,
      );
      candidateCount = candidates.length;
    }

    let curatorCalls = 0;
    try {
      const result = await runCuratorPass(
        admin,
        userId,
        environment,
        preferences,
        compiledWardrobeVersion,
        changeEvents.affectedItemIds,
        changeEvents.createdItemIds,
      );
      curatorCalls = result.calls;
    } catch {
      // Curator failure never blocks compilation: rows simply stay
      // curator_status='not_reviewed' and the deterministic
      // generated_by='compilation' library remains fully usable. The next
      // compile's catch-up shortlist retries them automatically.
    }

    const { data: finalizeResult, error: finalizeError } = await admin.rpc(
      "finalize_wardrobe_compilation",
      {
        p_job_id: jobId,
        p_user_id: userId,
        p_new_version: compiledWardrobeVersion,
        p_start_change_count: startChangeCount,
        p_candidate_count: candidateCount,
        p_items_considered: items.length,
      },
    );
    if (finalizeError) throw finalizeError;

    await enqueueAutomaticPreviewJobs(
      admin,
      userId,
      environment,
      changeEvents.createdItemIds,
      compiledWardrobeVersion,
    ).catch(() => {
      // Preview enqueue is best-effort and must never affect compile status.
    });

    if (changeEvents.eventIds.length > 0) {
      await admin
        .from("wardrobe_change_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .in("id", changeEvents.eventIds)
        .is("processed_at", null);
    }

    return {
      jobId,
      status: "complete" as const,
      candidatesGenerated: candidateCount,
      itemsConsidered: items.length,
      curatorCalls,
      changedDuringRun: Boolean(
        finalizeResult &&
          typeof finalizeResult === "object" &&
          "changed_during_run" in finalizeResult
          ? finalizeResult.changed_during_run
          : false,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown wardrobe compilation error";
    if (isNewVersion) {
      await discardUnpublishedVersion(admin, userId, compiledWardrobeVersion);
    }
    await admin
      .from("wardrobe_compilation_jobs")
      .update({
        status: "failed",
        error_code: "compilation_failed",
        error_message: message,
        locked_at: null,
        locked_until: null,
        next_attempt_at: retryAt(job.attempt_count),
      })
      .eq("id", jobId)
      .eq("user_id", userId);
    throw error;
  }
}
