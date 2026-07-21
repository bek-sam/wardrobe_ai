import { runStylistAgent } from "@/lib/ai/agents/stylist-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";
import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import { getServerEnvironment } from "@/lib/env/server";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";
import { validateGeneratedOutfit } from "@/lib/recommendation/outfit-validation";
import { createAdminClient } from "@/lib/supabase/admin";

export type StylistOrchestratorInput = {
  userId: string;
  request: string;
  date: string;
  location?: string | null;
  occasion?: string | null;
  targetFormality?: number;
  indoorOutdoor?: "indoor" | "outdoor" | "mixed" | null;
};

export function classifyWardrobeIntent(request: string) {
  const text = request.toLowerCase();
  if (/pack|trip|luggage|travel capsule/.test(text)) return "packing" as const;
  if (/plan|week|tomorrow|calendar|future/.test(text)) return "planning" as const;
  if (/insight|unused|wear|cost per wear|gap/.test(text)) return "insight" as const;
  if (/what is|do i own|find|show me/.test(text)) return "item_question" as const;
  return "outfit_request" as const;
}

export async function runWardrobeOrchestrator(input: StylistOrchestratorInput) {
  const startedAt = Date.now();
  const environment = getServerEnvironment();
  const { profile, style, feedback } = await getPreferences(input.userId);
  let weather: Awaited<ReturnType<typeof getWeatherForStyling>> = null;
  let weatherWarning: string | null = null;
  try {
    weather = await getWeatherForStyling({
      date: input.date,
      requestedLocation: input.location,
      profile,
      comfort: { runsCold: style.runs_cold, runsHot: style.runs_hot },
    });
  } catch {
    weatherWarning =
      "Weather is temporarily unavailable; this look is based on occasion and preferences.";
  }
  const candidates = await getWardrobeCandidates({
    userId: input.userId,
    weather: weather?.constraints,
    occasionTags: input.occasion ? [input.occasion] : [],
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
    weather: weather
      ? {
          ...weather.snapshot,
          constraints: weather.constraints,
          indoorOutdoor: input.indoorOutdoor,
        }
      : null,
    preferences: { ...style, feedback },
    recentWear: candidates.items.map((item) => ({
      id: item.id,
      wearCount: item.wear_count,
      lastWornAt: item.last_worn_at,
    })),
    candidates: candidates.items.map((item) => ({
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
      score: candidates.scores.get(item.id)?.total ?? 0,
    })),
  });
  const items = agent.result.itemIds.map((itemId, index) => {
    const item = candidates.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("The model selected an item outside the candidate set.");
    const role = resolveWardrobeItemRole(item);
    if (!role) throw new Error("The selected item has no valid outfit role.");
    return { item_id: itemId, role, sort_order: index };
  });
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
    candidates.items,
    { expectedUserId: input.userId },
  );
  if (!validation.success) {
    throw new Error(`The generated outfit failed validation: ${validation.issues[0]?.message}`);
  }

  const recordedOutfit = {
    title: validation.outfit.title,
    items: validation.outfit.items,
    explanation: validation.outfit.explanation,
    warnings: validation.outfit.warnings,
    confidence: validation.outfit.confidence,
    missing_category: validation.outfit.missing_category,
    follow_up_question: validation.outfit.follow_up_question,
  };
  const admin = createAdminClient();
  const { data: recordedRun } = await admin
    .from("agent_runs")
    .insert({
      user_id: input.userId,
      agent_type: "wardrobe_orchestrator",
      status: "complete",
      input_summary: {
        intent: classifyWardrobeIntent(input.request),
        date: input.date,
        occasion: input.occasion,
        candidateCount: candidates.items.length,
      },
      output_summary: {
        itemIds: agent.result.itemIds,
        responseId: agent.responseId,
        outfit: recordedOutfit,
        weatherContext: weather ?? {},
      },
      model: environment.OPENAI_STYLIST_MODEL ?? "unconfigured",
      latency_ms: Date.now() - startedAt,
      usage: agent.usage ?? {},
    })
    .select("id")
    .maybeSingle();
  return {
    generationId: recordedRun?.id ?? null,
    intent: classifyWardrobeIntent(input.request),
    outfit: validation.outfit,
    weather,
    excludedItemCount: candidates.excluded.length,
  };
}
