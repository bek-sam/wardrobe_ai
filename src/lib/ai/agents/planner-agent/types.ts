import type { WardrobeItem } from "@/features/wardrobe/types";
import type { getWeatherForStyling } from "@/lib/ai/tools/get-weather";

export type PlannerDayInput = {
  date: string;
  location?: string | null;
  occasion?: string | null;
};

export type PlannerDayWeather = Awaited<ReturnType<typeof getWeatherForStyling>>;

export type PlannerDay = {
  date: string;
  occasion: string | null;
  weather: PlannerDayWeather;
  eligibleItemIds: readonly string[];
};

export type RunPlannerAgentInput = {
  userId: string;
  days: readonly PlannerDay[];
  candidates: readonly WardrobeItem[];
  preferences: unknown;
};
