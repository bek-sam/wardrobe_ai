import type { IntentDateRange } from "../intent";
import type { UnwornItem, WardrobeInsights } from "@/lib/insights";
import type { InsightHighlight } from "..";
import type { InsightFocus } from "../intent";
import type { InsightAnswer } from "..";
import type { ItemQuery } from "../intent";
import type { WardrobeSearchResult } from "@/lib/wardrobe-search";
import type { ClothingConstraintTag } from "@/lib/weather";
import type { PackingListEntry, PlanDayView } from "..";
import type { OutfitItemRole } from "@/features/outfits";
import { buildPlannerDays, runPlannerAgent } from "@/lib/ai/agents/planner-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import type { WardrobeItem } from "@/features/wardrobe";
import type { PlannerDay } from "@/lib/ai/agents/planner-agent";
import type { PlannerResult } from "@/lib/ai/schemas";
import { resolveWardrobeItemRole } from "@/lib/recommendation";
import { addDays } from "../intent";
import { requirePlannerModel } from "..";
import type { PlanDayWeather } from "..";
import type { WardrobeIntent } from "../intent";
import { recordWardrobeOrchestratorRun } from "..";

/** Stable, timezone-free label ("Mon, Jul 27") for answer text. */
export function formatDayLabel(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatRangeLabel(window: IntentDateRange) {
  return window.dayCount === 1
    ? formatDayLabel(window.startDate)
    : `${formatDayLabel(window.startDate)} – ${formatDayLabel(window.endDate)}`;
}

const MAX_HIGHLIGHTS = 8;

function unwornHighlights(unworn: readonly UnwornItem[]): InsightHighlight[] {
  return unworn.slice(0, MAX_HIGHLIGHTS).map((entry) => ({
    label: entry.item.name,
    detail: entry.lastWornDate
      ? `last worn ${entry.lastWornDate} (${entry.daysSince} days ago)`
      : "never worn",
    itemId: entry.item.id,
  }));
}

/** Every highlight is computed from the user's own rows -- no model call. */
export function buildInsightHighlights(
  focus: InsightFocus,
  insights: WardrobeInsights,
  unworn: readonly UnwornItem[],
): InsightHighlight[] {
  if (focus === "unworn") return unwornHighlights(unworn);
  if (focus === "least_worn" || focus === "most_worn") {
    const items = focus === "most_worn" ? insights.mostWorn : insights.leastWorn;
    return items.slice(0, MAX_HIGHLIGHTS).map((item) => ({
      label: item.name,
      detail: `${item.wear_count} ${item.wear_count === 1 ? "wear" : "wears"}`,
      itemId: item.id,
    }));
  }
  if (focus === "cost_per_wear") {
    return insights.costPerWear.slice(0, MAX_HIGHLIGHTS).map((entry) => ({
      label: entry.name,
      detail: `${entry.value.toFixed(2)}${entry.currency ? ` ${entry.currency}` : ""} per wear`,
      itemId: entry.itemId,
    }));
  }
  if (focus === "gaps") {
    return [...insights.gapSuggestions, ...insights.overrepresented]
      .slice(0, MAX_HIGHLIGHTS)
      .map((entry) => ({
        label: "role" in entry ? `Missing: ${entry.role}` : `Heavy on: ${entry.name}`,
        detail: entry.note,
        itemId: null,
      }));
  }
  return insights.categories.slice(0, MAX_HIGHLIGHTS).map((category) => ({
    label: category.name,
    detail: `${category.count} ${category.count === 1 ? "item" : "items"}`,
    itemId: null,
  }));
}

function namedList(highlights: readonly InsightHighlight[], limit = 3) {
  return highlights
    .slice(0, limit)
    .map((highlight) => highlight.label)
    .join(", ");
}

/** Plain arithmetic over the user's wear logs, stated without embellishment. */
export function insightAnswerText(
  focus: InsightFocus,
  stats: InsightAnswer["stats"],
  since: string | null,
  highlights: readonly InsightHighlight[],
) {
  if (stats.itemCount === 0)
    return "Your active wardrobe is empty, so there is nothing to analyse yet.";
  if (focus === "unworn") {
    const scope = since ? `have no recorded wear since ${since}` : "have never been worn";
    if (stats.unwornCount === 0)
      return `Every one of your ${stats.itemCount} active items has been worn${since ? ` since ${since}` : ""}.`;
    return `${stats.unwornCount} of your ${stats.itemCount} active items ${scope}, starting with ${namedList(highlights)}.`;
  }
  if (focus === "least_worn") {
    return `Your least-worn active items are ${namedList(highlights)}; ${stats.neverWornCount} items have never been worn at all.`;
  }
  if (focus === "most_worn") return `You wear ${namedList(highlights)} the most.`;
  if (focus === "cost_per_wear") {
    return highlights.length
      ? `Your best cost per wear comes from ${namedList(highlights)}.`
      : "No item has both a purchase price and a recorded wear yet, so cost per wear cannot be computed.";
  }
  if (focus === "gaps") {
    return highlights.length
      ? `Coverage notes for your ${stats.itemCount} active items: ${namedList(highlights, 4)}.`
      : `Your ${stats.itemCount} active items cover every outfit role, with ${stats.possibleFoundations} possible foundations.`;
  }
  return `You have ${stats.itemCount} active items across ${highlights.length} categories (${namedList(highlights)}), ${stats.neverWornCount} of them never worn.`;
}

function describeQuery(query: ItemQuery) {
  const words = [...query.colors, ...query.categories];
  return (words.length ? words : query.terms).slice(0, 4).join(" ");
}

/** States ownership plainly; the match list carries the supporting detail. */
export function itemAnswerText(query: ItemQuery, result: WardrobeSearchResult) {
  if (query.terms.length === 0) {
    return "Tell me what to look for — a colour, a garment type, or a brand — and I will check your wardrobe.";
  }
  const described = describeQuery(query);
  if (result.matchCount === 0) {
    return `No active item in your wardrobe matches “${described}”. If you own one, it may be archived or not imported yet.`;
  }

  const names = result.matches
    .slice(0, 3)
    .map((match) => match.name)
    .join(", ");
  const unavailable = result.matches.filter((match) => match.availability !== "available").length;
  const caveat = unavailable ? ` ${unavailable} of them are not available right now.` : "";
  const noun = result.matchCount === 1 ? "item" : "items";
  return `Yes — you own ${result.matchCount} ${noun} matching “${described}”: ${names}.${caveat}`;
}

/** Deterministic weather-tag notes; never a model's idea of "essentials". */
const PACKING_ESSENTIAL_NOTES: Readonly<Record<ClothingConstraintTag, string>> = {
  needs_outer_layer: "at least one outer layer",
  needs_insulation: "an insulating layer for the cold days",
  wind_protection: "a wind-resistant layer",
  rain_protection: "rain protection",
  rain_safe_shoes: "shoes that handle rain",
  snow_safe_footwear: "snow-safe footwear",
  breathable_priority: "breathable fabrics for the heat",
  avoid_heavy_layers: "nothing heavier than you need",
  day_night_layer: "a layer for the temperature swing between day and night",
};

const PACKING_ROLE_ORDER: readonly OutfitItemRole[] = [
  "dress",
  "top",
  "bottom",
  "layer",
  "shoes",
  "accessory",
];

/** One row per distinct item, counting how many days of the trip use it. */
export function buildPackingList(views: readonly PlanDayView[]): PackingListEntry[] {
  const byItem = new Map<string, PackingListEntry>();
  for (const view of views) {
    for (const item of view.items) {
      const existing = byItem.get(item.item_id);
      if (existing) existing.dayCount += 1;
      else {
        byItem.set(item.item_id, {
          itemId: item.item_id,
          name: item.name,
          role: item.role,
          category: item.category,
          dayCount: 1,
        });
      }
    }
  }

  return [...byItem.values()].sort(
    (first, second) =>
      PACKING_ROLE_ORDER.indexOf(first.role) - PACKING_ROLE_ORDER.indexOf(second.role) ||
      second.dayCount - first.dayCount ||
      first.name.localeCompare(second.name),
  );
}

export function buildPackingEssentials(views: readonly PlanDayView[]) {
  const tags = new Set<ClothingConstraintTag>();
  for (const view of views) {
    for (const tag of view.weather?.tags ?? []) tags.add(tag as ClothingConstraintTag);
  }
  return [...tags]
    .map((tag) => PACKING_ESSENTIAL_NOTES[tag])
    .filter((note): note is string => Boolean(note));
}

export function planAnswerText(
  range: string,
  dayCount: number,
  missingCategories: readonly string[],
) {
  const gaps = missingCategories.length
    ? ` Gaps worth knowing about: ${missingCategories.slice(0, 3).join(", ")}.`
    : "";
  return `Here is a ${dayCount}-day plan for ${range}, built only from items you own and each day's forecast.${gaps} It was not saved automatically — use “Save plan” below to keep it.`;
}

export function packingAnswerText(
  range: string,
  dayCount: number,
  destination: string | null,
  packingList: readonly PackingListEntry[],
  essentials: readonly string[],
) {
  const where = destination ? ` for ${destination}` : "";
  const reuse = packingList.filter((entry) => entry.dayCount > 1).length;
  const notes = essentials.length ? ` Weather notes: ${essentials.join("; ")}.` : "";
  return `Pack ${packingList.length} owned pieces${where} to cover ${dayCount} days (${range}); ${reuse} of them repeat across days.${notes}`;
}

/**
 * The exact shape save_generated_week already accepts, and nothing else.
 *
 * This is what a chat plan can later be saved from, so it is deliberately the
 * narrowest possible record: owned item IDs with their resolved roles and sort
 * order, the day's own copy, and the same public weather context the answer
 * already showed the user. No prompts, no reasoning, no profile data, no
 * wardrobe rows, no coordinates or resolved private location -- PlanDayView's
 * weather is already the published subset (place name, min/max, precipitation
 * probability, constraint tags).
 */
export type RecordedPlanDay = {
  date: string;
  occasion: string | null;
  weather_context: Record<string, unknown>;
  name: string;
  explanation: string;
  confidence: number;
  items: { item_id: string; role: string; sort_order: number }[];
};

export function buildRecordedPlans(views: readonly PlanDayView[]): RecordedPlanDay[] {
  return views.map((view) => ({
    date: view.date,
    occasion: view.occasion,
    weather_context: view.weather ? { ...view.weather } : {},
    name: view.title,
    explanation: view.explanation,
    confidence: view.confidence,
    items: view.items.map((item) => ({
      item_id: item.item_id,
      role: item.role,
      sort_order: item.sort_order,
    })),
  }));
}

type PlanWindowInput = {
  userId: string;
  window: IntentDateRange;
  location: string | null;
  occasion: string | null;
};

function dayWeather(day: PlannerDay | undefined): PlanDayWeather | null {
  if (!day?.weather) return null;
  const { snapshot, constraints, location } = day.weather;
  return {
    locationName: location?.name ?? null,
    minimumTemperatureC: snapshot.minimumTemperatureC ?? null,
    maximumTemperatureC: snapshot.maximumTemperatureC ?? null,
    precipitationProbability: snapshot.precipitationProbability ?? null,
    tags: [...constraints.tags],
  };
}

/** Resolves planner output to owned items again before it leaves the server. */
function buildPlanDayViews(
  looks: PlannerResult["looks"],
  plannerDays: readonly PlannerDay[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
): PlanDayView[] {
  return [...looks]
    .sort((first, second) => first.date.localeCompare(second.date))
    .map((look) => {
      const day = plannerDays.find((candidate) => candidate.date === look.date);
      const items = look.itemIds.map((itemId, index) => {
        const item = candidateMap.get(itemId);
        const role = item ? resolveWardrobeItemRole(item) : null;
        if (!item || !role) throw new Error("A planned item has no valid role.");
        return {
          item_id: itemId,
          role,
          sort_order: index,
          name: item.name,
          category: item.category,
        };
      });
      return {
        date: look.date,
        title: look.title,
        explanation: look.explanation,
        confidence: look.confidence,
        occasion: day?.occasion ?? null,
        items,
        weather: dayWeather(day),
      };
    });
}

/**
 * Shared multi-day pipeline for the planning and packing routes: one planner
 * call over per-day weather and per-day eligible candidates.
 *
 * Quota is deliberately NOT charged here. This is not the authenticated
 * request boundary; both callers arrive from a boundary that has already
 * consumed exactly one planner unit for the resolved intent, so charging again
 * here would double-bill the same request.
 */
export async function runPlanForWindow(input: PlanWindowInput) {
  requirePlannerModel();
  const preferences = await getPreferences(input.userId);
  const days = Array.from({ length: input.window.dayCount }, (_unused, index) => ({
    date: addDays(input.window.startDate, index),
    location: input.location,
    occasion: input.occasion,
  }));
  const { candidateMap, plannerDays } = await buildPlannerDays(input.userId, days, preferences);
  const planned = await runPlannerAgent({
    userId: input.userId,
    days: plannerDays,
    candidates: [...candidateMap.values()],
    preferences: { ...preferences.style, feedback: preferences.feedback },
  });

  return {
    views: buildPlanDayViews(planned.result.looks, plannerDays, candidateMap),
    missingCategories: planned.result.missingCategories,
    responseId: planned.responseId,
    usage: planned.usage ?? {},
    model: "ai-orchestration:plan@v1",
  };
}

type RecordPlanRunInput = {
  userId: string;
  intent: WardrobeIntent;
  window: IntentDateRange;
  plan: Awaited<ReturnType<typeof runPlanForWindow>>;
  startedAt: number;
  destination?: string | null;
};

/** Safe summary only: dates, item ids, and planner metadata -- no prompts. */
export function recordPlanRun({
  userId,
  intent,
  window,
  plan,
  startedAt,
  destination,
}: RecordPlanRunInput) {
  return recordWardrobeOrchestratorRun({
    userId,
    inputSummary: {
      intent,
      source: "planner",
      startDate: window.startDate,
      endDate: window.endDate,
      dayCount: window.dayCount,
      destination: destination ?? null,
    },
    outputSummary: {
      dates: plan.views.map((view) => view.date),
      itemIds: plan.views.flatMap((view) => view.items.map((item) => item.item_id)),
      responseId: plan.responseId,
      missingCategories: plan.missingCategories,
      // Only a planning run is saveable, so only a planning run records the
      // replayable representation. A packing list stays advisory in this
      // iteration and deliberately carries nothing the save RPC could act on.
      ...(intent === "planning" ? { plans: buildRecordedPlans(plan.views) } : {}),
    },
    model: plan.model,
    latencyMs: Date.now() - startedAt,
    usage: plan.usage,
  });
}
