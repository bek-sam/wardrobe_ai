import type { OutfitItemRole } from "@/features/outfits";
import type { GarmentCategory } from "@/components/garments/GarmentArtwork";
import {
  isObject,
  safeColor,
  safeNullableString,
  safeNumber,
  safeString,
} from "@/lib/api/normalize";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { requestJson } from "@/lib/api/request";
import { useMemo } from "react";
import { useCallback } from "react";

export type WeatherView = {
  minimumC: number | null;
  maximumC: number | null;
  rainProbability: number | null;
  snowfallCm: number | null;
  weatherCode: number | null;
};

export type PlanItem = {
  id: string;
  name: string;
  role: OutfitItemRole;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export type PlanView = {
  id: string;
  plannedDate: string;
  startTime: string | null;
  occasion: string | null;
  locationName: string | null;
  eventTitle: string | null;
  status: "planned" | "worn" | "skipped";
  outfitId: string | null;
  outfitName: string | null;
  explanation: string | null;
  weather: WeatherView | null;
  items: PlanItem[];
};

export type OutfitOption = { id: string; name: string };

export type ProfileView = {
  locationName: string | null;
  temperatureUnit: "celsius" | "fahrenheit";
};

export type PlanFormState = {
  plannedDate: string;
  outfitId: string;
  startTime: string;
  occasion: string;
  locationName: string;
  eventTitle: string;
  status: "planned" | "skipped";
};

export type GenerateDay = { date: string; selected: boolean; occasion: string };

export type PlannerToolbarProps = {
  anchor: string;
  today: string;
  dates: string[];
  loading: boolean;
  profile: ProfileView;
  onShift: (days: number) => void;
  onToday: () => void;
};

export type PlanEditorProps = {
  date: string;
  plan: PlanView | null;
  outfits: OutfitOption[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const roles = new Set<OutfitItemRole>(["top", "bottom", "dress", "layer", "shoes", "accessory"]);

export const previewDays = [
  { date: "2026-07-21", occasion: "Client lunch", colors: ["#ddd4c2", "#293647", "#9c7250"] },
  { date: "2026-07-22", occasion: "Office", colors: ["#455746", "#d8d0bf", "#c9bca3"] },
  { date: "2026-07-23", occasion: "Open day", colors: [] },
] as const;

function relationObject(value: unknown) {
  if (Array.isArray(value)) return isObject(value[0]) ? value[0] : null;
  return isObject(value) ? value : null;
}

export function weatherFrom(value: unknown): WeatherView | null {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : value;
  const minimumC =
    safeNumber(snapshot.minimumTemperatureC) ?? safeNumber(snapshot.minimum_temperature_c);
  const maximumC =
    safeNumber(snapshot.maximumTemperatureC) ?? safeNumber(snapshot.maximum_temperature_c);
  const rainProbability =
    safeNumber(snapshot.precipitationProbability, 0, 100) ??
    safeNumber(snapshot.precipitation_probability, 0, 100);
  const snowfallCm = safeNumber(snapshot.snowfallCm, 0) ?? safeNumber(snapshot.snowfall_cm, 0);
  const weatherCode =
    safeNumber(value.weatherCode) ??
    safeNumber(value.weather_code) ??
    safeNumber(snapshot.weatherCode) ??
    safeNumber(snapshot.weather_code);
  if (
    minimumC === null &&
    maximumC === null &&
    rainProbability === null &&
    snowfallCm === null &&
    weatherCode === null
  ) {
    return null;
  }
  return { minimumC, maximumC, rainProbability, snowfallCm, weatherCode };
}

function normalizePlanItems(outfit: Record<string, unknown> | null): PlanItem[] {
  const rawItems = outfit && Array.isArray(outfit.outfit_items) ? outfit.outfit_items : [];
  const items: PlanItem[] = [];
  for (const entry of rawItems) {
    if (!isObject(entry)) continue;
    const wardrobeItem = relationObject(entry.wardrobe_items);
    const itemId = safeString(entry.item_id);
    const role = entry.role as OutfitItemRole;
    if (!uuidPattern.test(itemId) || !roles.has(role)) continue;
    items.push({
      id: itemId,
      name: wardrobeItem ? safeString(wardrobeItem.name, "Owned item") : "Owned item",
      role,
      primaryColor: wardrobeItem ? safeColor(wardrobeItem.primary_color_hex) : null,
      secondaryColor: wardrobeItem ? safeColor(wardrobeItem.secondary_color_hex) : null,
    });
  }
  return items;
}

export function normalizePlan(value: unknown): PlanView | null {
  if (!isObject(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) return null;
  const plannedDate = safeString(value.planned_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return null;
  const status = ["planned", "worn", "skipped"].includes(safeString(value.status))
    ? (value.status as "planned" | "worn" | "skipped")
    : "planned";
  const outfit = relationObject(value.outfits);
  const outfitId =
    typeof value.outfit_id === "string" && uuidPattern.test(value.outfit_id)
      ? value.outfit_id
      : null;
  return {
    id: value.id,
    plannedDate,
    startTime: safeNullableString(value.start_time),
    occasion: safeNullableString(value.occasion),
    locationName: safeNullableString(value.location_name),
    eventTitle: safeNullableString(value.event_title),
    status,
    outfitId,
    outfitName: outfit ? safeNullableString(outfit.name) : null,
    explanation: outfit ? safeNullableString(outfit.explanation) : null,
    weather: weatherFrom(value.weather_snapshot),
    items: normalizePlanItems(outfit),
  };
}

export function normalizeProfile(value: unknown): ProfileView {
  if (!isObject(value)) return { locationName: null, temperatureUnit: "celsius" };
  return {
    locationName: safeNullableString(value.home_location_name),
    temperatureUnit: value.temperature_unit === "fahrenheit" ? "fahrenheit" : "celsius",
  };
}

export function normalizeOutfitOptions(value: unknown): OutfitOption[] {
  if (!isObject(value) || !Array.isArray(value.outfits)) return [];
  return value.outfits
    .filter((entry): entry is Record<string, unknown> => isObject(entry))
    .flatMap((entry) => {
      const id = safeString(entry.id);
      return uuidPattern.test(id) ? [{ id, name: safeString(entry.name, "Saved outfit") }] : [];
    });
}

export function buildPlanPayload(form: PlanFormState, plan: PlanView | null) {
  const common = {
    outfit_id: form.outfitId || null,
    planned_date: form.plannedDate,
    start_time: form.startTime || null,
    occasion: form.occasion.trim() || null,
    location_name: form.locationName.trim() || null,
    event_title: form.eventTitle.trim() || null,
  };
  return plan
    ? { ...common, ...(plan.status === "worn" ? {} : { status: form.status }) }
    : { ...common, weather_snapshot: null, status: "planned" };
}

export function parseGenerateResponse(result: unknown): string {
  if (!isObject(result) || !Array.isArray(result.looks) || !Array.isArray(result.saved)) {
    throw new Error("The generated plan response was invalid.");
  }
  const missing = Array.isArray(result.missingCategories)
    ? result.missingCategories.filter((entry): entry is string => typeof entry === "string")
    : [];
  return `${result.saved.length} ${result.saved.length === 1 ? "look" : "looks"} planned${
    missing.length ? `. Missing categories: ${missing.join(", ")}.` : "."
  }`;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);
}

export function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDate(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function formatWeekRange(dates: string[]) {
  if (!dates.length) return "Seven-day plan";
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const first = formatter.format(parseIsoDate(dates[0]!));
  const lastDate = parseIsoDate(dates[dates.length - 1]!);
  return `${first}–${formatter.format(lastDate)}, ${lastDate.getFullYear()}`;
}

export function plansByDateMap(dates: string[], plans: PlanView[]): Map<string, PlanView[]> {
  return new Map(dates.map((date) => [date, plans.filter((plan) => plan.plannedDate === date)]));
}

export function countLooks(plans: PlanView[]): number {
  return plans.filter((plan) => plan.outfitId && plan.status === "planned").length;
}

export function countRainyDays(dates: string[], forecast: Map<string, WeatherView>): number {
  return dates.filter((date) => (forecast.get(date)?.rainProbability ?? 0) >= 35).length;
}

export function countOpenDays(dates: string[], plansByDate: Map<string, PlanView[]>): number {
  return dates.filter(
    (date) =>
      !(plansByDate.get(date) ?? []).some((plan) => plan.outfitId && plan.status !== "skipped"),
  ).length;
}

function convertedTemperature(valueC: number, unit: "celsius" | "fahrenheit") {
  return unit === "fahrenheit" ? Math.round((valueC * 9) / 5 + 32) : Math.round(valueC);
}

export function temperatureLabel(weather: WeatherView | null, unit: "celsius" | "fahrenheit") {
  if (!weather) return "—";
  const suffix = unit === "fahrenheit" ? "°F" : "°C";
  if (weather.minimumC !== null && weather.maximumC !== null) {
    return `${convertedTemperature(weather.minimumC, unit)}–${convertedTemperature(weather.maximumC, unit)}${suffix}`;
  }
  const one = weather.maximumC ?? weather.minimumC;
  return one === null ? "—" : `${convertedTemperature(one, unit)}${suffix}`;
}

export function artworkCategory(role: OutfitItemRole): GarmentCategory {
  return role;
}

export function useGenerateSubmit(days: GenerateDay[], onGenerated: (message: string) => void) {
  const [location, setLocation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = days.filter((day) => day.selected);
    if (!selected.length) {
      setError("Select at least one day to plan.");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const result = await requestJson<unknown>("/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({
          days: selected.map((day) => ({
            date: day.date,
            occasion: day.occasion.trim() || null,
            location: location.trim() || null,
          })),
          save: true,
        }),
        signal: controller.signal,
      });
      onGenerated(parseGenerateResponse(result));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The week could not be generated.");
    } finally {
      controllerRef.current = null;
      setGenerating(false);
    }
  }

  return { location, setLocation, generating, error, submit };
}

export function usePlannerDates(initialDate: string) {
  const [anchor, setAnchor] = useState(initialDate);
  const [today] = useState(initialDate);

  const dates = useMemo(
    () => (anchor ? Array.from({ length: 7 }, (_, index) => shiftDate(anchor, index)) : []),
    [anchor],
  );

  return { anchor, setAnchor, today, dates };
}

async function loadWeekForecast(
  dates: string[],
  plans: PlanView[],
  signal: AbortSignal,
): Promise<Map<string, WeatherView>> {
  const entries = await Promise.all(
    dates.map(async (date) => {
      const persisted = plans.find((plan) => plan.plannedDate === date && plan.weather)?.weather;
      if (persisted) return [date, persisted] as const;
      const plannedLocation = plans.find(
        (plan) => plan.plannedDate === date && plan.locationName,
      )?.locationName;
      try {
        const query = new URLSearchParams({ date });
        if (plannedLocation) query.set("location", plannedLocation);
        const raw = await requestJson<unknown>(`/api/weather?${query.toString()}`, { signal });
        return [date, weatherFrom(raw)] as const;
      } catch {
        return [date, null] as const;
      }
    }),
  );
  return new Map(
    entries.filter((entry): entry is readonly [string, WeatherView] => entry[1] !== null),
  );
}

async function loadPlans(query: URLSearchParams, signal: AbortSignal): Promise<PlanView[]> {
  const planResult = await requestJson<unknown>(`/api/plans?${query}`, { signal });
  const rawPlans = isObject(planResult) && Array.isArray(planResult.plans) ? planResult.plans : [];
  const basePlans = rawPlans.map(normalizePlan).filter((plan): plan is PlanView => Boolean(plan));
  return Promise.all(
    basePlans.map(async (plan) => {
      try {
        const detail = await requestJson<unknown>(`/api/plans/${encodeURIComponent(plan.id)}`, {
          signal,
        });
        return normalizePlan(detail) ?? plan;
      } catch {
        return plan;
      }
    }),
  );
}

export function usePlannerWeekData(supabaseConfigured: boolean, dates: string[]) {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [outfits, setOutfits] = useState<OutfitOption[]>([]);
  const [profile, setProfile] = useState<ProfileView>({
    locationName: null,
    temperatureUnit: "celsius",
  });
  const [forecast, setForecast] = useState<Map<string, WeatherView>>(new Map());
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadWeek = useCallback(async () => {
    if (!supabaseConfigured || !dates.length) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ from: dates[0]!, to: dates[6]!, limit: "100" });
      const [detailed, outfitResult, profileResult] = await Promise.all([
        loadPlans(query, controller.signal),
        requestJson<unknown>("/api/outfits?limit=100", { signal: controller.signal }),
        requestJson<unknown>("/api/profile", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setPlans(detailed);
      setOutfits(normalizeOutfitOptions(outfitResult));
      setProfile(normalizeProfile(profileResult));
      const nextForecast = await loadWeekForecast(dates, detailed, controller.signal);
      if (controller.signal.aborted) return;
      setForecast(nextForecast);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The planner could not be loaded.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [dates, supabaseConfigured]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWeek(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadWeek, refresh]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { plans, outfits, profile, forecast, loading, error, refresh, setRefresh };
}

export function usePlannerWorkspaceState(initialDate: string, supabaseConfigured: boolean) {
  const datesState = usePlannerDates(initialDate);
  const weekData = usePlannerWeekData(supabaseConfigured, datesState.dates);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ date: string; plan: PlanView | null } | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  return {
    ...datesState,
    ...weekData,
    notice,
    setNotice,
    editor,
    setEditor,
    generatorOpen,
    setGeneratorOpen,
  };
}
