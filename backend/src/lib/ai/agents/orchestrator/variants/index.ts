import type { OutfitVariantMode } from "@/lib/ai/schemas";
import type { RetrievedOutfitSelectionReason } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { RetrievedOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { VariantInput } from "@/lib/ai/agents/outfit-variants-agent";
import { resolveWardrobeItemRole } from "@/lib/recommendation";
import type { OutfitItemRole } from "@/features/outfits";
import type { OrchestratorWeather } from "..";
import type { OutfitVariantExplanation } from "@/lib/ai/schemas";
import { resolveOccasionContextWithEscalation } from "@/lib/ai/agents/occasion-agent";
import { runOutfitVariantsAgent } from "@/lib/ai/agents/outfit-variants-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { buildAgentWeatherContext } from "..";
import { requireStylistModel } from "..";
import { resolveOrchestratorWeather } from "..";
import { retrieveAlternatives } from "..";
import type { StylistOrchestratorInput } from "..";
import type { OutfitVariantsResult } from "@/lib/ai/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWardrobeOrchestratorRun } from "..";

/**
 * Retrieval already ranks along exactly the three axes the product needs, so
 * the modes are a presentation label over an existing selection strategy
 * rather than a second, competing ranking.
 */
export const MODE_FOR_SELECTION_REASON: Record<RetrievedOutfitSelectionReason, OutfitVariantMode> =
  {
    safest: "safe",
    underused: "fresh",
    expressive: "statement",
  };

export const MODE_ORDER: readonly OutfitVariantMode[] = ["safe", "fresh", "statement"];

/**
 * Compact metadata for an already-filtered, already-validated set — never the
 * whole wardrobe and never a raw image. Wear counts are included because the
 * "fresh" mode's whole point is surfacing something under-worn.
 */
export function buildVariantInput(candidate: RetrievedOutfitCandidate): VariantInput {
  const itemsById = new Map(candidate.resolvedItems.map((item) => [item.id, item]));
  return {
    variantId: candidate.candidateId,
    mode: MODE_FOR_SELECTION_REASON[candidate.selectionReason],
    items: candidate.items
      .slice()
      .sort((first, second) => first.sort_order - second.sort_order)
      .flatMap((member) => {
        const item = itemsById.get(member.item_id);
        if (!item) return [];
        return [
          {
            itemId: item.id,
            role: resolveWardrobeItemRole(item) ?? member.role,
            name: item.name,
            category: item.category,
            colors: item.color_names,
            pattern: item.pattern,
            fit: item.fit,
            silhouette: item.silhouette,
            warmthLevel: item.warmth_level,
            formalityLevel: item.formality_level,
            wearCount: item.wear_count,
            lastWornAt: item.last_worn_at,
          },
        ];
      }),
  };
}

/**
 * The lock invariant, enforced deterministically and before any model call: a
 * candidate that does not contain every locked item ID is dropped outright.
 * The model is never given the opportunity to "helpfully" substitute a locked
 * piece, because it never sees a look missing one.
 */
export function keepLockedCandidates(
  candidates: readonly RetrievedOutfitCandidate[],
  lockedItemIds: readonly string[],
): RetrievedOutfitCandidate[] {
  if (lockedItemIds.length === 0) return [...candidates];
  const required = new Set(lockedItemIds);
  return candidates.filter((candidate) => {
    const present = new Set(candidate.items.map((member) => member.item_id));
    return [...required].every((itemId) => present.has(itemId));
  });
}

export type VariantItemView = {
  itemId: string;
  role: OutfitItemRole;
  sortOrder: number;
  name: string;
  category: string;
  colorNames: string[];
  primaryColorHex: string | null;
  pattern: string | null;
  availabilityStatus: string;
  favorite: boolean;
  wearCount: number;
};

export type OutfitVariantView = {
  mode: OutfitVariantMode;
  candidateId: string;
  title: string;
  items: VariantItemView[];
  reasons: string[];
  warnings: string[];
  stylistNote: string;
  /** Model confidence, kept internal-ish: never rendered as a certainty score. */
  confidence: number;
  styleTags: string[];
  /** False when a piece has no cut-out photo, so try-on cannot render it. */
  canVisualize: boolean;
};

export type OutfitVariantsAnswer = {
  kind: "variants";
  generationId: string | null;
  variants: OutfitVariantView[];
  contextSummary: string;
  weather: OrchestratorWeather;
  /** Present when fewer than three meaningfully different looks exist yet. */
  shortfallReason: string | null;
};

/**
 * Honest, actionable copy for "we could not build three genuinely different
 * looks". Saying so is better than relabelling near-duplicates or quietly
 * relaxing a hard constraint to fill the third slot.
 */
export function variantShortfallReason(count: number): string | null {
  if (count >= 3) return null;
  if (count === 0) {
    return "No complete look in your wardrobe fits this request yet. Try a different occasion, or add a few more pieces.";
  }
  return count === 1
    ? "Only one look in your wardrobe genuinely fits this request. Adding more tops, bottoms, or shoes will unlock alternatives."
    : "Only two meaningfully different looks fit this request. A third would repeat most of the same pieces.";
}

/** Nothing fit the request (or the locks). Honest, with no fabricated look. */
export function emptyVariantsAnswer(weather: OrchestratorWeather): OutfitVariantsAnswer {
  return {
    kind: "variants",
    generationId: null,
    variants: [],
    contextSummary: "",
    weather,
    shortfallReason: variantShortfallReason(0),
  };
}

export function buildVariantView(
  candidate: RetrievedOutfitCandidate,
  explanation: OutfitVariantExplanation | undefined,
  itemIdsWithCutout: ReadonlySet<string>,
): OutfitVariantView {
  const itemsById = new Map(candidate.resolvedItems.map((item) => [item.id, item]));
  const items = candidate.items
    .slice()
    .sort((first, second) => first.sort_order - second.sort_order)
    .flatMap((member, index): VariantItemView[] => {
      const item = itemsById.get(member.item_id);
      if (!item) return [];
      return [
        {
          itemId: item.id,
          role: resolveWardrobeItemRole(item) ?? member.role,
          sortOrder: index,
          name: item.name,
          category: item.category,
          colorNames: item.color_names,
          primaryColorHex: item.primary_color_hex,
          pattern: item.pattern,
          availabilityStatus: item.availability_status,
          favorite: item.favorite,
          wearCount: item.wear_count,
        },
      ];
    });

  return {
    mode: MODE_FOR_SELECTION_REASON[candidate.selectionReason],
    candidateId: candidate.candidateId,
    title: explanation?.title ?? "A look from your wardrobe",
    items,
    reasons: explanation?.reasons ?? [],
    warnings: explanation?.warnings ?? [],
    stylistNote: explanation?.stylistNote ?? "",
    confidence: explanation?.confidence ?? 0.5,
    styleTags: candidate.styleTags,
    canVisualize: items.every((item) => itemIdsWithCutout.has(item.itemId)),
  };
}

/**
 * A safe, compact summary only: which modes were served, which candidate and
 * item IDs they used, and the provider response id. No prompt text, no
 * reasoning trace, no image data.
 */
function recordVariantsRun(
  input: StylistOrchestratorInput,
  agent: Awaited<ReturnType<typeof runOutfitVariantsAgent>>,
  variants: readonly OutfitVariantView[],
  startedAt: number,
) {
  return recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent: "outfit_request",
      date: input.date,
      occasion: input.occasion,
      source: "variants",
      variantCount: variants.length,
    },
    outputSummary: {
      responseId: agent.responseId,
      promptVersion: agent.promptVersion,
      variants: variants.map(({ mode, candidateId, items }) => ({
        mode,
        candidateId,
        itemIds: items.map((item) => item.itemId),
      })),
    },
    model: "ai-orchestration:explain-variants@v1",
    latencyMs: Date.now() - startedAt,
    usage: agent.usage ?? {},
  });
}

/**
 * Which of these items actually have an approved cut-out. Try-on renders from
 * cut-outs, so a look containing a manually added item that never went through
 * the photo pipeline is shown with "Try it on" disabled and an explanation,
 * rather than failing after the user has already spent a quota unit.
 */
async function loadItemIdsWithCutout(
  userId: string,
  itemIds: readonly string[],
): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const { data } = await createAdminClient()
    .from("wardrobe_item_images")
    .select("item_id")
    .eq("user_id", userId)
    .eq("kind", "cutout")
    .in("item_id", [...new Set(itemIds)]);
  return new Set((data ?? []).map((row) => row.item_id as string));
}

/** Pairs each validated candidate with its explanation and orders safe→statement. */
async function assembleVariantViews(
  userId: string,
  candidates: readonly RetrievedOutfitCandidate[],
  result: OutfitVariantsResult,
): Promise<OutfitVariantView[]> {
  const explanations = new Map(result.variants.map((variant) => [variant.variantId, variant]));
  const withCutouts = await loadItemIdsWithCutout(
    userId,
    candidates.flatMap((candidate) => candidate.items.map((member) => member.item_id)),
  );

  return candidates
    .map((candidate) =>
      buildVariantView(candidate, explanations.get(candidate.candidateId), withCutouts),
    )
    .sort((first, second) => MODE_ORDER.indexOf(first.mode) - MODE_ORDER.indexOf(second.mode));
}

/**
 * Surfaces every validated alternative retrieval found instead of discarding
 * two of the three. Retrieval and the deterministic validator have already
 * enforced ownership, availability, weather, role, and foundation rules; the
 * single model call here only writes the explanations.
 */
export async function answerOutfitVariants(
  input: StylistOrchestratorInput,
  lockedItemIds: readonly string[] = [],
): Promise<OutfitVariantsAnswer> {
  const startedAt = Date.now();
  requireStylistModel();
  const { profile, style, feedback } = await getPreferences(input.userId);
  const { weather } = await resolveOrchestratorWeather(input.date, input.location, profile, style);
  const occasionContext = await resolveOccasionContextWithEscalation(input.occasion, input.userId);
  const retrieved = await retrieveAlternatives(input, occasionContext, weather, style, feedback);
  // Locks are a hard filter applied before any model call: a candidate that
  // does not contain every locked item can never be served, so remix is
  // structurally incapable of changing a locked piece.
  const candidates = keepLockedCandidates(retrieved, lockedItemIds);

  if (candidates.length === 0) return emptyVariantsAnswer(weather);

  const agent = await runOutfitVariantsAgent({
    userId: input.userId,
    request: input.request,
    occasion: input.occasion ?? null,
    weather: buildAgentWeatherContext(weather, input.indoorOutdoor),
    preferences: { ...style, feedback },
    variants: candidates.map(buildVariantInput),
  });
  const variants = await assembleVariantViews(input.userId, candidates, agent.result);

  return {
    kind: "variants",
    generationId: await recordVariantsRun(input, agent, variants, startedAt),
    variants,
    contextSummary: agent.result.contextSummary,
    weather,
    shortfallReason: variantShortfallReason(variants.length),
  };
}
