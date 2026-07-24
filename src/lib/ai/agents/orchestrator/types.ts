import type { retrieveStoredOutfitCandidates } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";
import type { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { getServerEnvironment } from "@/lib/env/server";

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
  startedAt: number;
  environment: ReturnType<typeof getServerEnvironment>;
  style: Awaited<ReturnType<typeof getPreferences>>["style"];
  feedback: Awaited<ReturnType<typeof getPreferences>>["feedback"];
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>;
  weatherWarning: string | null;
};

export type TryServeRetrievedOutfitInput = {
  input: StylistOrchestratorInput;
  startedAt: number;
  environment: ReturnType<typeof getServerEnvironment>;
  profile: Awaited<ReturnType<typeof getPreferences>>["profile"];
  style: Awaited<ReturnType<typeof getPreferences>>["style"];
  feedback: Awaited<ReturnType<typeof getPreferences>>["feedback"];
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>;
  weatherWarning: string | null;
  retrieved: Awaited<ReturnType<typeof retrieveStoredOutfitCandidates>>[number];
};
