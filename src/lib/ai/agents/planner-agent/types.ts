import type { WardrobeItem } from "@/features/wardrobe/types";

export type PlannerDay = {
  date: string;
  occasion: string | null;
  weather: unknown;
  eligibleItemIds: readonly string[];
};

export type RunPlannerAgentInput = {
  userId: string;
  days: readonly PlannerDay[];
  candidates: readonly WardrobeItem[];
  preferences: unknown;
};
