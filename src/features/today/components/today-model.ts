import type { OutfitItemRole } from "@/features/outfits";
import type { GarmentCategory } from "@/components/garments/GarmentArtwork";
import { isObject, safeColor, safeNumber, safeString } from "@/lib/api/normalize";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { useRef } from "react";
import type { FormEvent } from "react";
import { useMemo } from "react";
import { useOutfitPreview } from "@/features/outfits/hooks";

export type TodayProfile = {
  firstName: string | null;
  displayName: string | null;
  locationName: string | null;
  timezone: string;
  locale: string;
  temperatureUnit: "celsius" | "fahrenheit";
};

export type TodayItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  layerRole: OutfitItemRole | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorNames: string[];
  availability: string;
  primaryImageUrl: string | null;
  createdAt: string | null;
};

export type WeatherView = {
  provider: string | null;
  date: string | null;
  locationName: string | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  minimumC: number | null;
  maximumC: number | null;
  rainProbability: number | null;
  precipitationMm: number | null;
  snowfallCm: number | null;
  windKph: number | null;
  humidityPercent: number | null;
  temperatureBand: string | null;
  constraints: string[];
};

export type OutfitSelection = { item_id: string; role: OutfitItemRole; sort_order: number };

export type TodayPreviewInfo = {
  candidateId: string;
  status: "none" | "queued" | "generating" | "ready" | "failed";
  styleTags: string[];
};

export type TodayRecommendation = {
  generationId: string | null;
  title: string;
  items: OutfitSelection[];
  itemDetails: Record<string, TodayItem>;
  explanation: string;
  warnings: string[];
  confidence: number;
  missingCategory: string | null;
  followUpQuestion: string | null;
  weather: WeatherView | null;
  excludedItemCount: number;
  savedOutfitId: string | null;
  occasion: string | null;
  preview: TodayPreviewInfo | null;
};

export type NormalizedRecommendation = Omit<TodayRecommendation, "itemDetails" | "occasion">;

export type TodayLookDetailsProps = {
  recommendation: TodayRecommendation;
  recommendationWeather: WeatherView | null;
  previewImageUrl: string | null;
  previewStatus: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
  saving: boolean;
  notice: string | null;
  onSave: () => void;
};

export type TodayContextFormProps = {
  occasion: string;
  onOccasion: (value: string) => void;
  generating: "unsaved" | "saved" | null;
  coreLoading: boolean;
  itemCount: number;
  hasItems: boolean;
  aiConfigured: boolean;
  onSubmit: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onBuildAndSave: () => void;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const outfitRoles = new Set<OutfitItemRole>([
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
]);

const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);

const constraintCopy: Readonly<Record<string, string>> = {
  needs_outer_layer: "Bring an outer layer for the cooler part of the day.",
  needs_insulation: "Insulating pieces are useful in today’s temperatures.",
  wind_protection: "A wind-blocking layer is recommended.",
  rain_protection: "Plan for rain protection.",
  rain_safe_shoes: "Choose shoes that can handle wet conditions.",
  snow_safe_footwear: "Snow-safe footwear is recommended.",
  breathable_priority: "Prioritize breathable pieces.",
  avoid_heavy_layers: "Avoid heavy layers in the warmer part of the day.",
  day_night_layer: "Keep a layer ready for the day-to-night temperature change.",
};

export const quickOccasions = ["Work", "Casual day", "Dinner", "Outdoors"];

function safeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeStrings(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .map((entry) => entry.trim())
        .slice(0, maximum)
    : [];
}

export function normalizeItem(value: unknown, expectedId?: string): TodayItem | null {
  if (!isObject(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) return null;
  if (expectedId && value.id !== expectedId) return null;
  const name = safeNullableString(value.name);
  const category = safeNullableString(value.category);
  if (!name || !category) return null;
  return {
    id: value.id,
    name,
    brand: safeNullableString(value.brand),
    category,
    subcategory: safeNullableString(value.subcategory),
    layerRole: outfitRoles.has(value.layer_role as OutfitItemRole)
      ? (value.layer_role as OutfitItemRole)
      : null,
    primaryColor: safeColor(value.primary_color_hex),
    secondaryColor: safeColor(value.secondary_color_hex),
    colorNames: safeStrings(value.color_names, 8),
    availability: safeString(value.availability_status, "unknown"),
    primaryImageUrl: safeNullableString(value.primary_image_url),
    createdAt: safeNullableString(value.created_at),
  };
}

export function normalizeProfile(value: unknown): TodayProfile | null {
  if (!isObject(value)) return null;
  return {
    firstName: safeNullableString(value.first_name),
    displayName: safeNullableString(value.display_name),
    locationName: safeNullableString(value.home_location_name),
    timezone: safeString(value.timezone, "UTC"),
    locale: safeString(value.locale, "en-US"),
    temperatureUnit: value.temperature_unit === "fahrenheit" ? "fahrenheit" : "celsius",
  };
}

export function normalizeWeather(value: unknown): WeatherView | null {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : {};
  const location = isObject(value.location) ? value.location : {};
  const constraints = isObject(value.constraints) ? value.constraints : {};
  return {
    provider: safeNullableString(value.provider),
    date: safeNullableString(value.date),
    locationName: safeNullableString(location.name),
    temperatureC: safeNumber(snapshot.temperatureC),
    feelsLikeC: safeNumber(snapshot.feelsLikeC),
    minimumC: safeNumber(snapshot.minimumTemperatureC),
    maximumC: safeNumber(snapshot.maximumTemperatureC),
    rainProbability: safeNumber(snapshot.precipitationProbability, 0, 100),
    precipitationMm: safeNumber(snapshot.precipitationMm, 0),
    snowfallCm: safeNumber(snapshot.snowfallCm, 0),
    windKph: safeNumber(snapshot.windSpeedKph, 0),
    humidityPercent: safeNumber(snapshot.humidityPercent, 0, 100),
    temperatureBand: safeNullableString(constraints.temperatureBand),
    constraints: safeStrings(constraints.tags, 12),
  };
}

export function normalizeRecommendationItems(rawItems: unknown[]): OutfitSelection[] | null {
  const items: OutfitSelection[] = [];
  const seenIds = new Set<string>();
  const seenRoles = new Set<OutfitItemRole>();
  for (const [index, rawItem] of rawItems.entries()) {
    if (!isObject(rawItem)) return null;
    const itemId = safeString(rawItem.item_id);
    const role = rawItem.role as OutfitItemRole;
    if (
      !uuidPattern.test(itemId) ||
      !outfitRoles.has(role) ||
      seenIds.has(itemId) ||
      seenRoles.has(role)
    ) {
      return null;
    }
    seenIds.add(itemId);
    seenRoles.add(role);
    items.push({
      item_id: itemId,
      role,
      sort_order:
        typeof rawItem.sort_order === "number" && Number.isInteger(rawItem.sort_order)
          ? rawItem.sort_order
          : index,
    });
  }
  return items.length ? items : null;
}

function normalizePreview(value: unknown): TodayPreviewInfo | null {
  if (!isObject(value)) return null;
  const candidateId = safeString(value.candidateId);
  if (!uuidPattern.test(candidateId)) return null;
  const status =
    typeof value.status === "string" && previewStatuses.has(value.status)
      ? (value.status as TodayPreviewInfo["status"])
      : "none";
  return { candidateId, status, styleTags: safeStrings(value.styleTags, 5) };
}

export function savedOutfitId(value: unknown) {
  if (typeof value === "string" && uuidPattern.test(value)) return value;
  if (isObject(value) && typeof value.id === "string" && uuidPattern.test(value.id)) {
    return value.id;
  }
  return null;
}

export function normalizeTodayRecommendation(value: unknown): NormalizedRecommendation | null {
  if (!isObject(value) || !isObject(value.outfit)) return null;
  const outfit = value.outfit;
  const title = safeNullableString(outfit.title);
  const explanation = safeNullableString(outfit.explanation);
  const confidence = safeNumber(outfit.confidence, 0, 1);
  if (!title || !explanation || confidence === null || !Array.isArray(outfit.items)) return null;
  const items = normalizeRecommendationItems(outfit.items);
  if (!items) return null;
  return {
    generationId:
      typeof value.generationId === "string" && uuidPattern.test(value.generationId)
        ? value.generationId
        : null,
    title,
    items,
    explanation,
    warnings: safeStrings(outfit.warnings, 10),
    confidence,
    missingCategory: safeNullableString(outfit.missing_category),
    followUpQuestion: safeNullableString(outfit.follow_up_question),
    weather: normalizeWeather(value.weather),
    excludedItemCount:
      typeof value.excludedItemCount === "number" && Number.isInteger(value.excludedItemCount)
        ? Math.max(0, value.excludedItemCount)
        : 0,
    savedOutfitId: savedOutfitId(value.savedOutfit),
    preview: normalizePreview(value.preview),
  };
}

export function artworkCategory(role: OutfitItemRole): GarmentCategory {
  return role;
}

export function previewLabel(previewStatus: string | null): string {
  if (previewStatus === "queued" || previewStatus === "generating") return "Finish this preview";
  if (previewStatus === "failed") return "Retry the modeled preview";
  return "Generate a modeled preview";
}

export function greeting(profile: TodayProfile | null) {
  let hour = new Date().getHours();
  if (profile) {
    try {
      const value = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: profile.timezone,
      })
        .formatToParts(new Date())
        .find((part) => part.type === "hour")?.value;
      if (value) hour = Number(value);
    } catch {
      // Fall back to the browser clock when a stale timezone cannot be formatted.
    }
  }
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile?.firstName ?? profile?.displayName;
  return `${salutation}${name ? `, ${name}` : ""}.`;
}

export function temperature(value: number | null, unit: TodayProfile["temperatureUnit"]) {
  if (value === null) return null;
  const converted = unit === "fahrenheit" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(converted)}°${unit === "fahrenheit" ? "F" : "C"}`;
}

export function readableToken(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function weatherHeadline(weather: WeatherView) {
  if ((weather.snowfallCm ?? 0) > 0) return "Snow is in today’s forecast";
  if ((weather.rainProbability ?? 0) >= 40 || (weather.precipitationMm ?? 0) >= 0.5) {
    return "Rain is possible today";
  }
  return weather.temperatureBand
    ? `${readableToken(weather.temperatureBand)} conditions today`
    : "Today’s forecast";
}

export function weatherReasons(weather: WeatherView | null) {
  if (!weather) return [];
  return weather.constraints
    .map((constraint) => constraintCopy[constraint])
    .filter((reason): reason is string => Boolean(reason));
}

type ApiEnvelope<T> = { data: T } | { error: { code?: string; message?: string } };

export class TodayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "TodayRequestError";
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    const code = payload && "error" in payload ? (payload.error.code ?? null) : null;
    throw new TodayRequestError(
      response.status,
      code,
      errorMessage(payload, `The request failed (${response.status}).`),
    );
  }
  return payload.data;
}

export async function fetchSelectedDetails(
  selections: OutfitSelection[],
  signal: AbortSignal,
): Promise<Record<string, TodayItem>> {
  const detailPairs = await Promise.all(
    selections.map(async (selection) => {
      const raw = await requestJson<unknown>(
        `/api/items/${encodeURIComponent(selection.item_id)}`,
        { signal },
      );
      const item = normalizeItem(raw, selection.item_id);
      if (!item) throw new Error(`Owned item ${selection.item_id} could not be verified.`);
      return [selection.item_id, item] as const;
    }),
  );
  return Object.fromEntries(detailPairs);
}

export async function loadTodayWeather(date: string, signal: AbortSignal): Promise<WeatherView> {
  const raw = await requestJson<unknown>(`/api/weather?date=${encodeURIComponent(date)}`, {
    signal,
  });
  const weather = normalizeWeather(raw);
  if (!weather) throw new Error("Today’s weather response could not be read.");
  return weather;
}

export function todayWeatherErrorMessage(caught: unknown): string {
  if (caught instanceof TodayRequestError && caught.code === "location_required") {
    return "Add a home location in Settings to load today’s forecast.";
  }
  return caught instanceof Error ? caught.message : "Today’s weather could not be loaded.";
}

export async function generateTodayOutfit(
  today: string,
  occasion: string | null,
  saveImmediately: boolean,
  signal: AbortSignal,
): Promise<TodayRecommendation> {
  const raw = await requestJson<unknown>("/api/outfits/generate", {
    method: "POST",
    body: JSON.stringify({
      message: occasion
        ? `Build a weather-aware outfit from my owned, available wardrobe for ${occasion} today.`
        : "Build a weather-aware outfit from my owned, available wardrobe for today.",
      date: today,
      location: null,
      occasion,
      indoorOutdoor: null,
      save: saveImmediately,
    }),
    signal,
  });
  const normalized = normalizeTodayRecommendation(raw);
  if (!normalized) throw new Error("The stylist returned an invalid recommendation.");
  if (saveImmediately && !normalized.savedOutfitId) {
    throw new Error("The outfit was generated but its saved record could not be verified.");
  }
  const itemDetails = await fetchSelectedDetails(normalized.items, signal);
  return { ...normalized, itemDetails, occasion };
}

export async function loadTodayProfileItems(signal: AbortSignal) {
  const [profileResult, itemsResult] = await Promise.allSettled([
    requestJson<unknown>("/api/profile", { signal }),
    requestJson<unknown>("/api/items?status=active&limit=8", { signal }),
  ]);

  const errors: string[] = [];
  let profile: TodayProfile | null = null;
  if (profileResult.status === "fulfilled") {
    profile = normalizeProfile(profileResult.value);
    if (!profile) errors.push("Your profile response could not be read.");
  } else if (!(
    profileResult.reason instanceof DOMException && profileResult.reason.name === "AbortError"
  )) {
    errors.push(
      profileResult.reason instanceof Error
        ? profileResult.reason.message
        : "Your profile could not be loaded.",
    );
  }

  let items: TodayItem[] = [];
  let itemCount = 0;
  if (itemsResult.status === "fulfilled" && isObject(itemsResult.value)) {
    const rawItems = Array.isArray(itemsResult.value.items) ? itemsResult.value.items : [];
    items = rawItems
      .map((item) => normalizeItem(item))
      .filter((item): item is TodayItem => Boolean(item));
    itemCount =
      typeof itemsResult.value.count === "number" && Number.isInteger(itemsResult.value.count)
        ? Math.max(0, itemsResult.value.count)
        : items.length;
  } else if (itemsResult.status === "rejected") {
    if (!(itemsResult.reason instanceof DOMException && itemsResult.reason.name === "AbortError")) {
      errors.push(
        itemsResult.reason instanceof Error
          ? itemsResult.reason.message
          : "Recent wardrobe items could not be loaded.",
      );
    }
  } else {
    errors.push("Your wardrobe response could not be read.");
  }

  return { profile, items, itemCount, errors };
}

export function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateInTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`;
    }
  } catch {
    // A database constraint validates IANA zones; retain a local fallback for stale rows.
  }
  return localIsoDate();
}

export function formattedDate(date: string, locale: string) {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

type Deps = {
  aiConfigured: boolean;
  coreLoading: boolean;
  today: string;
  itemsLength: number;
  occasion: string;
  generating: "unsaved" | "saved" | null;
  setGenerating: Dispatch<SetStateAction<"unsaved" | "saved" | null>>;
  setRecommendation: Dispatch<SetStateAction<TodayRecommendation | null>>;
  setGenerationError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  generationAbortRef: MutableRefObject<AbortController | null>;
};

export function useGenerateToday(deps: Deps) {
  return async function generate(saveImmediately: boolean) {
    if (!deps.aiConfigured || deps.coreLoading || deps.generating || !deps.itemsLength) return;
    const requestedOccasion = deps.occasion.trim() || null;
    const controller = new AbortController();
    deps.generationAbortRef.current = controller;
    deps.setGenerating(saveImmediately ? "saved" : "unsaved");
    deps.setGenerationError(null);
    deps.setNotice(null);
    deps.setRecommendation(null);
    try {
      const result = await generateTodayOutfit(
        deps.today,
        requestedOccasion,
        saveImmediately,
        controller.signal,
      );
      deps.setRecommendation(result);
      deps.setNotice(
        result.savedOutfitId
          ? "Today’s outfit was generated and saved."
          : "Today’s outfit is ready. Save it when you want to keep it.",
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      deps.setGenerationError(
        caught instanceof Error ? caught.message : "Today’s outfit could not be generated.",
      );
    } finally {
      if (deps.generationAbortRef.current === controller) deps.generationAbortRef.current = null;
      deps.setGenerating(null);
    }
  };
}

export function useTodayCoreData(reloadVersion: number) {
  const [profile, setProfile] = useState<TodayProfile | null>(null);
  const [today, setToday] = useState(localIsoDate);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [weather, setWeather] = useState<WeatherView | null>(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      const {
        profile: nextProfile,
        items: nextItems,
        itemCount: nextCount,
        errors,
      } = await loadTodayProfileItems(controller.signal);
      if (!active) return;
      const nextDate = dateInTimezone(nextProfile?.timezone ?? "UTC");
      setProfile(nextProfile);
      setToday(nextDate);
      setItems(nextItems);
      setItemCount(nextCount);
      setCoreError(errors.length ? errors.join(" ") : null);
      setCoreLoading(false);

      try {
        setWeather(await loadTodayWeather(nextDate, controller.signal));
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setWeather(null);
        setWeatherError(todayWeatherErrorMessage(caught));
      } finally {
        if (active) setWeatherLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadVersion]);

  return {
    profile,
    today,
    items,
    itemCount,
    weather,
    coreLoading,
    weatherLoading,
    coreError,
    weatherError,
    setCoreLoading,
    setWeatherLoading,
    setCoreError,
    setWeatherError,
  };
}

function useSaveTodayRecommendation(
  recommendation: TodayRecommendation | null,
  setRecommendation: Dispatch<SetStateAction<TodayRecommendation | null>>,
  setGenerationError: Dispatch<SetStateAction<string | null>>,
  setNotice: Dispatch<SetStateAction<string | null>>,
) {
  const [saving, setSaving] = useState(false);

  async function saveRecommendation() {
    if (!recommendation || recommendation.savedOutfitId || saving) return;
    if (!recommendation.generationId) {
      setGenerationError(
        "This recommendation is missing its secure generation record. Generate it again before saving.",
      );
      return;
    }
    setSaving(true);
    setGenerationError(null);
    setNotice(null);
    try {
      const raw = await requestJson<unknown>("/api/outfits/generated", {
        method: "POST",
        body: JSON.stringify({ generationId: recommendation.generationId }),
      });
      const id = savedOutfitId(raw);
      if (!id) throw new Error("The saved outfit response could not be verified.");
      setRecommendation((current) => (current ? { ...current, savedOutfitId: id } : current));
      setNotice("Today’s outfit was saved.");
    } catch (caught) {
      setGenerationError(
        caught instanceof Error ? caught.message : "Today’s outfit could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return { saving, saveRecommendation };
}

type Args = { aiConfigured: boolean; coreLoading: boolean; today: string; itemsLength: number };

export function useTodayGeneration({ aiConfigured, coreLoading, today, itemsLength }: Args) {
  const generationAbortRef = useRef<AbortController | null>(null);
  const [occasion, setOccasion] = useState("");
  const [recommendation, setRecommendation] = useState<TodayRecommendation | null>(null);
  const [generating, setGenerating] = useState<"unsaved" | "saved" | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const savedState = useSaveTodayRecommendation(
    recommendation,
    setRecommendation,
    setGenerationError,
    setNotice,
  );
  const generate = useGenerateToday({
    aiConfigured,
    coreLoading,
    today,
    itemsLength,
    occasion,
    generating,
    setGenerating,
    setRecommendation,
    setGenerationError,
    setNotice,
    generationAbortRef,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void generate(false);
  };

  return {
    occasion,
    setOccasion,
    recommendation,
    generating,
    generationError,
    notice,
    generate,
    submit,
    generationAbortRef,
    ...savedState,
  };
}

export function useTodayWorkspaceState(aiConfigured: boolean) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const core = useTodayCoreData(reloadVersion);
  const generation = useTodayGeneration({
    aiConfigured,
    coreLoading: core.coreLoading,
    today: core.today,
    itemsLength: core.items.length,
  });
  const preview = useOutfitPreview(
    generation.recommendation?.preview?.candidateId ?? null,
    generation.recommendation?.preview?.status ?? null,
  );

  useEffect(
    () => () => generation.generationAbortRef.current?.abort(),
    [generation.generationAbortRef],
  );

  const recentItems = useMemo(() => core.items.slice(0, 4), [core.items]);
  const dateLabel = formattedDate(core.today, core.profile?.locale ?? "en-US");

  function retryLoad() {
    core.setCoreLoading(true);
    core.setWeatherLoading(true);
    core.setCoreError(null);
    core.setWeatherError(null);
    setReloadVersion((current) => current + 1);
  }

  return { ...core, ...generation, ...preview, recentItems, dateLabel, retryLoad };
}
