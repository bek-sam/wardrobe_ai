import type { OutfitItemRole } from "@/features/outfits";
import type { ValidatedOutfit } from "@/lib/recommendation";
import type { WardrobeSearchMatch } from "@/lib/wardrobe-search";
import type { InsightFocus, WardrobeIntent } from "./intent";
import type { WardrobeItem } from "@/features/wardrobe";
import { resolveWardrobeItemRole } from "@/lib/recommendation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";
import type { OccasionContext } from "@/lib/recommendation";
import { after } from "next/server";
import { recordFallbackOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";
import { runStylistAgent } from "@/lib/ai/agents/stylist-agent";
import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";
import { confidentOccasionTags } from "@/lib/recommendation";
import { validateGeneratedOutfit } from "@/lib/recommendation";
import { ApiError } from "@/lib/api/response";
import { getServerEnvironment, type ServerEnvironment } from "@/lib/env/server";
import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import { retrieveStoredOutfitCandidates } from "@/lib/ai/agents/retrieve-outfit-candidate";
import { markOutfitCandidateSuggested } from "@/lib/ai/agents/retrieve-outfit-candidate";
import { explainWardrobeCandidate } from "@/lib/ai/agents/stylist-agent";

export function buildAgentWeatherContext(
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>,
  indoorOutdoor: "indoor" | "outdoor" | "mixed" | null | undefined,
) {
  return weather ? { ...weather.snapshot, constraints: weather.constraints, indoorOutdoor } : null;
}

export type OrchestratorWeather = Awaited<ReturnType<typeof getWeatherForStyling>>;

export type WardrobeAnswerBase = {
  /** agent_runs row id, so a result stays auditable and savable. */
  generationId: string | null;
  intent: WardrobeIntent;
  /** Single user-facing sentence (or short paragraph) for every answer kind. */
  answer: string;
};

export type OutfitAnswer = WardrobeAnswerBase & {
  kind: "outfit";
  outfit: ValidatedOutfit;
  weather: OrchestratorWeather;
  excludedItemCount: number;
  preview: { candidateId: string; status: string; styleTags: string[] } | null;
};

export type PlanDayItem = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
  name: string;
  category: string;
};

export type PlanDayWeather = {
  locationName: string | null;
  minimumTemperatureC: number | null;
  maximumTemperatureC: number | null;
  precipitationProbability: number | null;
  tags: string[];
};

export type PlanDayView = {
  date: string;
  title: string;
  explanation: string;
  confidence: number;
  occasion: string | null;
  items: PlanDayItem[];
  weather: PlanDayWeather | null;
};

export type PlanAnswer = WardrobeAnswerBase & {
  kind: "plan";
  intent: "planning";
  startDate: string;
  endDate: string;
  dayCount: number;
  days: PlanDayView[];
  missingCategories: string[];
  /**
   * Chat never auto-saves: a fresh plan answer is always false and only an
   * explicit save (POST /api/plans/generated) makes it true.
   */
  saved: boolean;
};

export type PackingListEntry = {
  itemId: string;
  name: string;
  role: OutfitItemRole;
  category: string;
  dayCount: number;
};

export type PackingAnswer = WardrobeAnswerBase & {
  kind: "packing";
  intent: "packing";
  destination: string | null;
  startDate: string;
  endDate: string;
  dayCount: number;
  days: PlanDayView[];
  packingList: PackingListEntry[];
  essentials: string[];
  missingCategories: string[];
};

export type InsightHighlight = {
  label: string;
  detail: string | null;
  itemId: string | null;
};

export type InsightAnswer = WardrobeAnswerBase & {
  kind: "insight";
  intent: "insight";
  focus: InsightFocus;
  /** ISO date the "not worn since" question was measured against, if any. */
  since: string | null;
  highlights: InsightHighlight[];
  stats: {
    itemCount: number;
    neverWornCount: number;
    unwornCount: number;
    possibleFoundations: number;
  };
};

export type ItemQuestionAnswer = WardrobeAnswerBase & {
  kind: "item_question";
  intent: "item_question";
  query: string;
  matches: WardrobeSearchMatch[];
  matchCount: number;
};

export type WardrobeAnswer =
  OutfitAnswer | PlanAnswer | PackingAnswer | InsightAnswer | ItemQuestionAnswer;

type CandidateItem = Pick<
  WardrobeItem,
  | "id"
  | "name"
  | "category"
  | "subcategory"
  | "layer_role"
  | "color_names"
  | "pattern"
  | "fit"
  | "silhouette"
  | "warmth_level"
  | "formality_level"
  | "occasion_tags"
  | "weather_tags"
>;

export function buildCandidateSummary(item: CandidateItem, score: number) {
  return {
    id: item.id,
    name: item.name,
    role: resolveWardrobeItemRole(item),
    category: item.category,
    colors: item.color_names,
    pattern: item.pattern,
    fit: item.fit,
    silhouette: item.silhouette,
    warmthLevel: item.warmth_level,
    formalityLevel: item.formality_level,
    occasionTags: item.occasion_tags,
    weatherTags: item.weather_tags,
    score,
  };
}

export function buildRecentWear(item: Pick<WardrobeItem, "id" | "wear_count" | "last_worn_at">) {
  return { id: item.id, wearCount: item.wear_count, lastWornAt: item.last_worn_at };
}

type RecordAgentRunInput = {
  userId: string;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  model: string;
  latencyMs: number;
  usage: unknown;
};

export async function recordWardrobeOrchestratorRun({
  userId,
  inputSummary,
  outputSummary,
  model,
  latencyMs,
  usage,
}: RecordAgentRunInput): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_type: "wardrobe_orchestrator",
      status: "complete",
      input_summary: inputSummary,
      output_summary: outputSummary,
      model,
      latency_ms: latencyMs,
      usage,
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export function summarizeValidatedOutfit(outfit: ValidatedOutfit) {
  return {
    title: outfit.title,
    items: outfit.items,
    explanation: outfit.explanation,
    warnings: outfit.warnings,
    confidence: outfit.confidence,
    missing_category: outfit.missing_category,
    follow_up_question: outfit.follow_up_question,
  };
}

export type StylistOrchestratorInput = {
  userId: string;
  request: string;
  date: string;
  location?: string | null;
  occasion?: string | null;
  targetFormality?: number;
  indoorOutdoor?: "indoor" | "outdoor" | "mixed" | null;
};

export type ComposeOutfitInput = {
  input: StylistOrchestratorInput;
  intent: WardrobeIntent;
  startedAt: number;
  style: Awaited<ReturnType<typeof getPreferences>>["style"];
  feedback: Awaited<ReturnType<typeof getPreferences>>["feedback"];
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>;
  weatherWarning: string | null;
  occasionContext: OccasionContext;
};

export type TryServeRetrievedOutfitInput = {
  input: StylistOrchestratorInput;
  intent: WardrobeIntent;
  startedAt: number;
  profile: Awaited<ReturnType<typeof getPreferences>>["profile"];
  style: Awaited<ReturnType<typeof getPreferences>>["style"];
  feedback: Awaited<ReturnType<typeof getPreferences>>["feedback"];
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>;
  weatherWarning: string | null;
  retrieved: Awaited<ReturnType<typeof retrieveStoredOutfitCandidates>>[number];
};

function resolveOutfitItemRoles(itemIds: readonly string[], candidates: readonly WardrobeItem[]) {
  return itemIds.map((itemId, index) => {
    const item = candidates.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("The model selected an item outside the candidate set.");
    const role = resolveWardrobeItemRole(item);
    if (!role) throw new Error("The selected item has no valid outfit role.");
    return { item_id: itemId, role, sort_order: index };
  });
}

function validateAgentOutfit(
  agent: Awaited<ReturnType<typeof runStylistAgent>>,
  candidates: readonly WardrobeItem[],
  userId: string,
  weatherWarning: string | null,
) {
  const items = resolveOutfitItemRoles(agent.result.itemIds, candidates);
  const validation = validateGeneratedOutfit(
    {
      title: agent.result.title,
      items,
      explanation: agent.result.explanation,
      warnings: [...(weatherWarning ? [weatherWarning] : []), ...agent.result.warnings],
      confidence: agent.result.confidence,
      missing_category: agent.result.missingCategory,
      follow_up_question: agent.result.followUpQuestion,
    },
    candidates,
    { expectedUserId: userId },
  );
  if (!validation.success) {
    throw new Error(`The generated outfit failed validation: ${validation.issues[0]?.message}`);
  }
  return validation;
}

async function generateCandidateOutfit({
  input,
  style,
  feedback,
  weather,
  weatherWarning,
  occasionContext,
}: ComposeOutfitInput) {
  const candidates = await getWardrobeCandidates({
    userId: input.userId,
    weather: weather?.constraints,
    occasionTags: confidentOccasionTags(occasionContext) ?? [],
    targetFormality: input.targetFormality ?? style.preferred_formality ?? undefined,
    favoriteColors: style.favorite_colors,
    avoidedColors: style.avoided_colors,
    preferredFits: style.preferred_fits,
    likedItemIds: feedback.likedItemIds,
    dislikedItemIds: feedback.dislikedItemIds,
  });

  const agent = await runStylistAgent({
    userId: input.userId,
    request: input.request,
    occasion: input.occasion,
    weather: buildAgentWeatherContext(weather, input.indoorOutdoor),
    preferences: { ...style, feedback },
    recentWear: candidates.items.map(buildRecentWear),
    candidates: candidates.items.map((item) =>
      buildCandidateSummary(item, candidates.scores.get(item.id)?.total ?? 0),
    ),
  });

  const validation = validateAgentOutfit(agent, candidates.items, input.userId, weatherWarning);
  return { candidates, agent, validation };
}

export async function composeOutfit(composeInput: ComposeOutfitInput): Promise<OutfitAnswer> {
  const { input, intent, startedAt, weather } = composeInput;
  const { candidates, agent, validation } = await generateCandidateOutfit(composeInput);

  const generationId = await recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent,
      date: input.date,
      occasion: input.occasion,
      candidateCount: candidates.items.length,
      source: "composition",
    },
    outputSummary: {
      itemIds: agent.result.itemIds,
      responseId: agent.responseId,
      outfit: summarizeValidatedOutfit(validation.outfit),
      weatherContext: weather ?? {},
    },
    model: "ai-orchestration:select-outfit@v1",
    latencyMs: Date.now() - startedAt,
    usage: agent.usage ?? {},
  });

  after(() =>
    recordFallbackOutfitCandidate({
      userId: input.userId,
      occasion: input.occasion,
      items: validation.outfit.items,
    }),
  );

  return {
    kind: "outfit",
    generationId,
    intent,
    answer: validation.outfit.explanation,
    outfit: validation.outfit,
    weather,
    excludedItemCount: candidates.excluded.length,
    // A freshly composed outfit has no library candidate at response time
    // (recordFallbackOutfitCandidate creates one afterward, best-effort, via
    // after()), so there is nothing yet to attach a preview reference to.
    preview: null,
  };
}

export {
  classifyWardrobeIntent,
  classifyWardrobeIntentDetailed,
  resolveWardrobeIntent,
  resolveWardrobeIntentDeterministic,
  WARDROBE_INTENTS,
} from "./intent";

export type { ResolvedIntent, WardrobeIntent } from "./intent";

/**
 * Model-backed routes fail closed with a typed, user-facing error instead of
 * pretending to succeed. The deterministic item-lookup and insight routes call
 * neither of these, so they keep working when AI Orchestration is unavailable.
 */
function requireAiOrchestration(code: string, message: string): ServerEnvironment {
  const environment = getServerEnvironment();
  if (!environment.AI_ORCHESTRATION_URL || !environment.AI_SERVICE_TOKEN) {
    throw new ApiError(503, code, message);
  }
  return environment;
}

export function requireStylistModel() {
  return requireAiOrchestration(
    "stylist_model_unavailable",
    "Outfit generation is not configured on this server. Wardrobe lookups and insights still work.",
  );
}

export function requirePlannerModel() {
  return requireAiOrchestration(
    "planner_model_unavailable",
    "Planning and packing are not configured on this server. Wardrobe lookups and insights still work.",
  );
}

export async function resolveOrchestratorWeather(
  date: string,
  location: string | null | undefined,
  profile: Awaited<ReturnType<typeof getPreferences>>["profile"],
  style: Awaited<ReturnType<typeof getPreferences>>["style"],
): Promise<{
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>;
  weatherWarning: string | null;
}> {
  try {
    const weather = await getWeatherForStyling({
      date,
      requestedLocation: location,
      profile,
      comfort: { runsCold: style.runs_cold, runsHot: style.runs_hot },
    });
    return { weather, weatherWarning: null };
  } catch {
    return {
      weather: null,
      weatherWarning:
        "Weather is temporarily unavailable; this look is based on occasion and preferences.",
    };
  }
}

export async function retrieveAlternatives(
  input: StylistOrchestratorInput,
  occasionContext: OccasionContext,
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>,
  style: Awaited<ReturnType<typeof getPreferences>>["style"],
  feedback: Awaited<ReturnType<typeof getPreferences>>["feedback"],
) {
  return retrieveStoredOutfitCandidates({
    userId: input.userId,
    occasionContext,
    targetFormality: input.targetFormality ?? style.preferred_formality ?? undefined,
    weather: weather?.constraints,
    preferences: {
      favoriteColors: style.favorite_colors,
      avoidedColors: style.avoided_colors,
      preferredFits: style.preferred_fits,
      likedItemIds: feedback.likedItemIds,
      dislikedItemIds: feedback.dislikedItemIds,
    },
  }).catch(() => []);
}

/**
 * The classified intent is a route, not a label: each branch runs the tool
 * that can actually answer that question. Only "outfit_request" composes an
 * outfit, so an item lookup or a wear-history question never spends a stylist
 * call trying to dress the user.
 *
 * `resolved` comes from the authenticated chat boundary, which has to know the
 * route before it can charge the right quota. Threading it through is what
 * guarantees a request is classified exactly once per turn.
 */

async function generateRetrievedExplanation({
  input,
  style,
  feedback,
  weather,
  weatherWarning,
  retrieved,
}: TryServeRetrievedOutfitInput) {
  const explanation = await explainWardrobeCandidate({
    userId: input.userId,
    request: input.request,
    occasion: input.occasion,
    weather: buildAgentWeatherContext(weather, input.indoorOutdoor),
    preferences: { ...style, feedback },
    recentWear: retrieved.resolvedItems.map(buildRecentWear),
    items: retrieved.resolvedItems.map((item) => buildCandidateSummary(item, retrieved.score)),
  });

  const validation = validateGeneratedOutfit(
    {
      title: explanation.result.title,
      items: retrieved.items.map(({ item_id, role, sort_order }) => ({
        item_id,
        role,
        sort_order,
      })),
      explanation: explanation.result.explanation,
      warnings: [...(weatherWarning ? [weatherWarning] : []), ...explanation.result.warnings],
      confidence: explanation.result.confidence,
      missing_category: null,
      follow_up_question: null,
    },
    retrieved.resolvedItems,
    { expectedUserId: input.userId },
  );

  return { explanation, validation };
}

type Explanation = Awaited<ReturnType<typeof generateRetrievedExplanation>>["explanation"];

function recordRetrievedOutfitRun(
  context: TryServeRetrievedOutfitInput,
  explanation: Explanation,
  outfit: ValidatedOutfit,
) {
  const { input, intent, startedAt, weather, retrieved } = context;
  return recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent,
      date: input.date,
      occasion: input.occasion,
      source: "retrieval",
      candidateId: retrieved.candidateId,
    },
    outputSummary: {
      itemIds: retrieved.items.map((item) => item.item_id),
      responseId: explanation.responseId,
      outfit: summarizeValidatedOutfit(outfit),
      weatherContext: weather ?? {},
    },
    model: "ai-orchestration:explain-outfit@v1",
    latencyMs: Date.now() - startedAt,
    usage: explanation.usage ?? {},
  });
}

// Best-effort: queue a modeled preview for next time if this served candidate
// doesn't have one yet and the user has consented. Never runs the preview
// pipeline synchronously and never blocks the response returned to the caller.
function scheduleRetrievedOutfitFollowUp({
  input,
  profile,
  retrieved,
}: Pick<TryServeRetrievedOutfitInput, "input" | "profile" | "retrieved">) {
  return Promise.all([
    markOutfitCandidateSuggested(input.userId, retrieved.candidateId).catch(() => {
      // Exposure tracking is a non-critical optimization; never surface this.
    }),
    profile?.modeled_preview_consent && retrieved.previewStatus !== "ready"
      ? createAdminClient()
          .rpc("enqueue_outfit_preview_job", {
            p_user_id: input.userId,
            p_candidate_id: retrieved.candidateId,
            p_priority_reason: "frequently_suggested",
          })
          .then(
            () => undefined,
            () => undefined,
          )
      : Promise.resolve(),
  ]);
}

// Asks the model only to explain an already-selected candidate instead of
// composing a fresh outfit. Returns null (never throws) on any failure so the
// caller can fall back to full composition exactly as if retrieval had found
// nothing.
export async function tryServeRetrievedOutfit(
  context: TryServeRetrievedOutfitInput,
): Promise<OutfitAnswer | null> {
  const { input, intent, profile, weather, retrieved } = context;
  try {
    const { explanation, validation } = await generateRetrievedExplanation(context);
    if (!validation.success) return null;

    const generationId = await recordRetrievedOutfitRun(context, explanation, validation.outfit);
    after(() => scheduleRetrievedOutfitFollowUp({ input, profile, retrieved }));

    return {
      kind: "outfit",
      generationId,
      intent,
      answer: validation.outfit.explanation,
      outfit: validation.outfit,
      weather,
      excludedItemCount: 0,
      preview: {
        candidateId: retrieved.candidateId,
        status: retrieved.previewStatus,
        styleTags: retrieved.styleTags,
      },
    };
  } catch {
    return null;
  }
}
