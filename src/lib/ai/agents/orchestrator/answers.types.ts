import type { OutfitItemRole } from "@/features/outfits/types";
import type { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { ValidatedOutfit } from "@/lib/recommendation/outfit-validation";
import type { WardrobeSearchMatch } from "@/lib/wardrobe-search";

import type { InsightFocus, WardrobeIntent } from "./intent";

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
