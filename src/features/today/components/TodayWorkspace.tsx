"use client";

import {
  ArrowRight,
  CalendarBlank,
  Check,
  CloudRain,
  Heart,
  MapPin,
  Sparkle,
  SpinnerGap,
  ThermometerSimple,
  WarningCircle,
  Wind,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import type { OutfitItemRole } from "@/features/outfits/types";
import {
  GarmentArtwork,
  type GarmentCategory,
} from "@/features/wardrobe/components/GarmentArtwork";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

type ApiEnvelope<T> = { data: T } | { error: { code?: string; message?: string } };

type TodayProfile = {
  firstName: string | null;
  displayName: string | null;
  locationName: string | null;
  timezone: string;
  locale: string;
  temperatureUnit: "celsius" | "fahrenheit";
};

type TodayItem = {
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

type WeatherView = {
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

type OutfitSelection = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
};

type TodayPreviewInfo = {
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

type NormalizedRecommendation = Omit<TodayRecommendation, "itemDetails" | "occasion">;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const outfitRoles = new Set<OutfitItemRole>([
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
]);
const quickOccasions = ["Work", "Casual day", "Dinner", "Outdoors"];

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

class TodayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "TodayRequestError";
  }
}

const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNumber(value: unknown, minimum?: number, maximum?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (minimum !== undefined && value < minimum) return null;
  if (maximum !== undefined && value > maximum) return null;
  return value;
}

function safeStrings(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .map((entry) => entry.trim())
        .slice(0, maximum)
    : [];
}

function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function errorMessage(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
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

function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInTimezone(timezone: string) {
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

function normalizeProfile(value: unknown): TodayProfile | null {
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

function normalizeItem(value: unknown, expectedId?: string): TodayItem | null {
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

function normalizeWeather(value: unknown): WeatherView | null {
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

function savedOutfitId(value: unknown) {
  if (typeof value === "string" && uuidPattern.test(value)) return value;
  if (isObject(value) && typeof value.id === "string" && uuidPattern.test(value.id)) {
    return value.id;
  }
  return null;
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

export function normalizeTodayRecommendation(value: unknown): NormalizedRecommendation | null {
  if (!isObject(value) || !isObject(value.outfit)) return null;
  const outfit = value.outfit;
  const title = safeNullableString(outfit.title);
  const explanation = safeNullableString(outfit.explanation);
  const confidence = safeNumber(outfit.confidence, 0, 1);
  if (!title || !explanation || confidence === null || !Array.isArray(outfit.items)) return null;

  const items: OutfitSelection[] = [];
  const seenIds = new Set<string>();
  const seenRoles = new Set<OutfitItemRole>();
  for (const [index, rawItem] of outfit.items.entries()) {
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
  if (!items.length) return null;

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

function artworkCategory(role: OutfitItemRole): GarmentCategory {
  return role;
}

function readableToken(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function temperature(value: number | null, unit: TodayProfile["temperatureUnit"]) {
  if (value === null) return null;
  const converted = unit === "fahrenheit" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(converted)}°${unit === "fahrenheit" ? "F" : "C"}`;
}

function weatherHeadline(weather: WeatherView) {
  if ((weather.snowfallCm ?? 0) > 0) return "Snow is in today’s forecast";
  if ((weather.rainProbability ?? 0) >= 40 || (weather.precipitationMm ?? 0) >= 0.5) {
    return "Rain is possible today";
  }
  return weather.temperatureBand
    ? `${readableToken(weather.temperatureBand)} conditions today`
    : "Today’s forecast";
}

function weatherReasons(weather: WeatherView | null) {
  if (!weather) return [];
  return weather.constraints
    .map((constraint) => constraintCopy[constraint])
    .filter((reason): reason is string => Boolean(reason));
}

function formattedDate(date: string, locale: string) {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function greeting(profile: TodayProfile | null) {
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

function TodayWeatherCard({
  weather,
  loading,
  error,
  profile,
  onRetry,
}: {
  weather: WeatherView | null;
  loading: boolean;
  error: string | null;
  profile: TodayProfile | null;
  onRetry: () => void;
}) {
  const unit = profile?.temperatureUnit ?? "fahrenheit";
  if (loading) {
    return (
      <section className="weather-card weather-card--status" aria-busy="true" role="status">
        <SpinnerGap className="spin" size={34} aria-hidden="true" />
        <div>
          <h2>Loading today’s weather…</h2>
          <p>Using your saved location and comfort settings.</p>
        </div>
      </section>
    );
  }
  if (!weather) {
    return (
      <section className="weather-card weather-card--status" aria-labelledby="weather-title">
        <WarningCircle size={34} aria-hidden="true" />
        <div>
          <h2 id="weather-title">Weather context unavailable</h2>
          <p>{error ?? "Add a home location to use weather-aware recommendations."}</p>
          <div className="weather-card__status-actions">
            <Button onClick={onRetry} variant="secondary">
              Try again
            </Button>
            <ButtonLink href="/settings" variant="ghost">
              Check location
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  const mainTemperature = temperature(weather.temperatureC, unit);
  const minimum = temperature(weather.minimumC, unit);
  const maximum = temperature(weather.maximumC, unit);
  const range = minimum && maximum ? `${minimum}–${maximum}` : (minimum ?? maximum);
  const reasons = weatherReasons(weather);
  const wet = (weather.rainProbability ?? 0) >= 40 || (weather.precipitationMm ?? 0) >= 0.5;

  return (
    <section className="weather-card" aria-labelledby="weather-title">
      <div className="weather-card__topline">
        <span>
          <MapPin size={14} aria-hidden="true" />
          {weather.locationName ?? profile?.locationName ?? "Saved location"}
        </span>
        <Badge tone="outline">{weather.provider ?? "Live forecast"}</Badge>
      </div>
      <div className="weather-card__forecast">
        {wet ? (
          <CloudRain size={48} weight="duotone" aria-hidden="true" />
        ) : (
          <ThermometerSimple size={48} weight="duotone" aria-hidden="true" />
        )}
        <div>
          <strong>{mainTemperature ?? range ?? "—"}</strong>
          <span>
            {weather.feelsLikeC !== null
              ? `Feels like ${temperature(weather.feelsLikeC, unit)}`
              : range && mainTemperature
                ? `Range ${range}`
                : "Forecast range unavailable"}
          </span>
        </div>
      </div>
      <div className="weather-card__copy">
        <h2 id="weather-title">{weatherHeadline(weather)}</h2>
        <p>{reasons[0] ?? "No special clothing constraints were derived for today."}</p>
      </div>
      <div className="weather-card__facts">
        {weather.rainProbability !== null ? (
          <span>
            <CloudRain size={15} aria-hidden="true" /> {Math.round(weather.rainProbability)}% rain
          </span>
        ) : null}
        {weather.windKph !== null ? (
          <span>
            <Wind size={15} aria-hidden="true" /> {Math.round(weather.windKph)} km/h
          </span>
        ) : null}
        {weather.humidityPercent !== null ? (
          <span>{Math.round(weather.humidityPercent)}% humidity</span>
        ) : null}
      </div>
    </section>
  );
}

function ItemVisual({
  item,
  role,
  compact = false,
}: {
  item: TodayItem;
  role: OutfitItemRole | null;
  compact?: boolean;
}) {
  if (item.primaryImageUrl) {
    return (
      <Image
        alt={item.name}
        className="today-item-photo"
        height={640}
        sizes={compact ? "78px" : "(max-width: 600px) 40vw, 180px"}
        src={item.primaryImageUrl}
        unoptimized
        width={480}
      />
    );
  }
  if (!role) {
    return (
      <span className="today-item-fallback" aria-hidden="true">
        {item.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <GarmentArtwork
      compact={compact}
      category={artworkCategory(role)}
      color={item.primaryColor ?? "#827c73"}
      accent={item.secondaryColor ?? undefined}
    />
  );
}

export function TodayWorkspace({ aiConfigured }: { aiConfigured: boolean }) {
  const generationAbortRef = useRef<AbortController | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [profile, setProfile] = useState<TodayProfile | null>(null);
  const [today, setToday] = useState(localIsoDate);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [weather, setWeather] = useState<WeatherView | null>(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [occasion, setOccasion] = useState("");
  const [recommendation, setRecommendation] = useState<TodayRecommendation | null>(null);
  const [generating, setGenerating] = useState<"unsaved" | "saved" | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const previewCandidateId = recommendation?.preview?.candidateId ?? null;
  const previewStatus = recommendation?.preview?.status ?? null;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPreviewImageUrl(null);
      setPreviewNotice(null);
      if (!previewCandidateId || previewStatus !== "ready") return;
      try {
        const data = await requestJson<{ status: string; previewUrl: string | null }>(
          `/api/outfit-candidates/${previewCandidateId}/preview`,
          { signal: controller.signal },
        );
        setPreviewImageUrl(data.previewUrl);
      } catch {
        // A failed fetch just means no image renders.
      }
    })();
    return () => controller.abort();
  }, [previewCandidateId, previewStatus]);

  const requestPreview = useCallback(async () => {
    if (!previewCandidateId) return;
    setPreviewRequestBusy(true);
    setPreviewNotice(null);
    try {
      const result = await requestJson<{ status: string }>(
        `/api/outfit-candidates/${previewCandidateId}/preview`,
        { method: "POST" },
      );
      setPreviewNotice(
        result.status === "already_fresh"
          ? "A preview is already ready."
          : "Preview requested — this can take a minute. Check back shortly.",
      );
    } catch (previewError) {
      setPreviewNotice(
        previewError instanceof Error
          ? previewError.message
          : "The preview could not be requested.",
      );
    } finally {
      setPreviewRequestBusy(false);
    }
  }, [previewCandidateId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      const [profileResult, itemsResult] = await Promise.allSettled([
        requestJson<unknown>("/api/profile", { signal: controller.signal }),
        requestJson<unknown>("/api/items?status=active&limit=8", { signal: controller.signal }),
      ]);
      if (!active) return;

      const errors: string[] = [];
      let nextProfile: TodayProfile | null = null;
      if (profileResult.status === "fulfilled") {
        nextProfile = normalizeProfile(profileResult.value);
        if (!nextProfile) errors.push("Your profile response could not be read.");
      } else if (!(
        profileResult.reason instanceof DOMException && profileResult.reason.name === "AbortError"
      )) {
        errors.push(
          profileResult.reason instanceof Error
            ? profileResult.reason.message
            : "Your profile could not be loaded.",
        );
      }

      let nextItems: TodayItem[] = [];
      let nextCount = 0;
      if (itemsResult.status === "fulfilled" && isObject(itemsResult.value)) {
        const rawItems = Array.isArray(itemsResult.value.items) ? itemsResult.value.items : [];
        nextItems = rawItems
          .map((item) => normalizeItem(item))
          .filter((item): item is TodayItem => Boolean(item));
        nextCount =
          typeof itemsResult.value.count === "number" && Number.isInteger(itemsResult.value.count)
            ? Math.max(0, itemsResult.value.count)
            : nextItems.length;
      } else if (itemsResult.status === "rejected") {
        if (!(
          itemsResult.reason instanceof DOMException && itemsResult.reason.name === "AbortError"
        )) {
          errors.push(
            itemsResult.reason instanceof Error
              ? itemsResult.reason.message
              : "Recent wardrobe items could not be loaded.",
          );
        }
      } else {
        errors.push("Your wardrobe response could not be read.");
      }

      const nextDate = dateInTimezone(nextProfile?.timezone ?? "UTC");
      setProfile(nextProfile);
      setToday(nextDate);
      setItems(nextItems);
      setItemCount(nextCount);
      setCoreError(errors.length ? errors.join(" ") : null);
      setCoreLoading(false);

      try {
        const rawWeather = await requestJson<unknown>(
          `/api/weather?date=${encodeURIComponent(nextDate)}`,
          { signal: controller.signal },
        );
        if (!active) return;
        const nextWeather = normalizeWeather(rawWeather);
        if (!nextWeather) throw new Error("Today’s weather response could not be read.");
        setWeather(nextWeather);
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setWeather(null);
        setWeatherError(
          caught instanceof TodayRequestError && caught.code === "location_required"
            ? "Add a home location in Settings to load today’s forecast."
            : caught instanceof Error
              ? caught.message
              : "Today’s weather could not be loaded.",
        );
      } finally {
        if (active) setWeatherLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadVersion]);

  useEffect(() => () => generationAbortRef.current?.abort(), []);

  const recentItems = useMemo(() => items.slice(0, 4), [items]);
  const dateLabel = formattedDate(today, profile?.locale ?? "en-US");

  async function fetchSelectedDetails(selections: OutfitSelection[], signal: AbortSignal) {
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
    return Object.fromEntries(detailPairs) as Record<string, TodayItem>;
  }

  async function generate(saveImmediately: boolean) {
    if (!aiConfigured || coreLoading || generating || !items.length) return;
    const requestedOccasion = occasion.trim() || null;
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setGenerating(saveImmediately ? "saved" : "unsaved");
    setGenerationError(null);
    setNotice(null);
    setRecommendation(null);
    try {
      const raw = await requestJson<unknown>("/api/outfits/generate", {
        method: "POST",
        body: JSON.stringify({
          message: requestedOccasion
            ? `Build a weather-aware outfit from my owned, available wardrobe for ${requestedOccasion} today.`
            : "Build a weather-aware outfit from my owned, available wardrobe for today.",
          date: today,
          location: null,
          occasion: requestedOccasion,
          indoorOutdoor: null,
          save: saveImmediately,
        }),
        signal: controller.signal,
      });
      const normalized = normalizeTodayRecommendation(raw);
      if (!normalized) throw new Error("The stylist returned an invalid recommendation.");
      if (saveImmediately && !normalized.savedOutfitId) {
        throw new Error("The outfit was generated but its saved record could not be verified.");
      }
      const itemDetails = await fetchSelectedDetails(normalized.items, controller.signal);
      setRecommendation({ ...normalized, itemDetails, occasion: requestedOccasion });
      setNotice(
        normalized.savedOutfitId
          ? "Today’s outfit was generated and saved."
          : "Today’s outfit is ready. Save it when you want to keep it.",
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setGenerationError(
        caught instanceof Error ? caught.message : "Today’s outfit could not be generated.",
      );
    } finally {
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
      setGenerating(null);
    }
  }

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generate(false);
  }

  function retryLoad() {
    setCoreLoading(true);
    setWeatherLoading(true);
    setCoreError(null);
    setWeatherError(null);
    setReloadVersion((current) => current + 1);
  }

  const recommendationWeather = recommendation?.weather ?? weather;
  const recommendationReasons = weatherReasons(recommendationWeather);

  return (
    <div className="page-stack today-page today-page--live">
      <PageHeader
        eyebrow={dateLabel}
        title={coreLoading ? "Loading today…" : greeting(profile)}
        description="Let’s make getting dressed the easiest decision of your day."
        meta={<Badge tone="sage">Live wardrobe</Badge>}
        actions={
          <ButtonLink href="/stylist">
            Ask your stylist <Sparkle aria-hidden="true" size={16} />
          </ButtonLink>
        }
      />

      {coreError ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} aria-hidden="true" />
          <span>{coreError}</span>
          <Button onClick={retryLoad} variant="ghost">
            Retry
          </Button>
        </div>
      ) : null}

      {!aiConfigured ? (
        <div className="inline-feedback inline-feedback--error" role="status">
          <WarningCircle size={17} aria-hidden="true" />
          <span>
            Live wardrobe and weather data are available, but outfit generation requires the
            server’s OpenAI stylist configuration.
          </span>
        </div>
      ) : null}

      <div className="today-grid">
        <TodayWeatherCard
          error={weatherError}
          loading={weatherLoading}
          onRetry={retryLoad}
          profile={profile}
          weather={weather}
        />
        <Card className="context-card" as="section">
          <div className="context-card__icon">
            <CalendarBlank size={22} weight="light" aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Today’s context</p>
            <h2>What are you dressing for?</h2>
            <p>Choose a shortcut or describe today’s occasion in your own words.</p>
          </div>
          <form className="today-context-form" onSubmit={submit}>
            <div className="context-card__choices" aria-label="Common occasions">
              {quickOccasions.map((choice) => (
                <button
                  aria-pressed={occasion === choice}
                  className={occasion === choice ? "is-active" : ""}
                  disabled={Boolean(generating)}
                  key={choice}
                  onClick={() => setOccasion(choice)}
                  type="button"
                >
                  {choice}
                </button>
              ))}
            </div>
            <label className="form-field" htmlFor="today-occasion">
              <span>Occasion or dress code</span>
              <input
                className="text-input"
                disabled={Boolean(generating)}
                id="today-occasion"
                maxLength={120}
                onChange={(event) => setOccasion(event.target.value)}
                placeholder="For example: client meeting, then dinner"
                value={occasion}
              />
            </label>
            <div className="today-context-form__meta">
              <span>
                {coreLoading
                  ? "Loading your wardrobe…"
                  : itemCount
                    ? `${itemCount} active ${itemCount === 1 ? "item" : "items"}; availability is filtered before styling.`
                    : "Add clothes before requesting an owned-item outfit."}
              </span>
            </div>
            <div className="today-context-form__actions">
              <Button
                disabled={!aiConfigured || coreLoading || Boolean(generating) || !items.length}
                type="submit"
              >
                {generating === "unsaved" ? (
                  <SpinnerGap className="spin" size={16} aria-hidden="true" />
                ) : (
                  <Sparkle size={16} aria-hidden="true" />
                )}
                Build today’s look
              </Button>
              <Button
                disabled={!aiConfigured || coreLoading || Boolean(generating) || !items.length}
                onClick={() => void generate(true)}
                variant="secondary"
              >
                {generating === "saved" ? (
                  <SpinnerGap className="spin" size={16} aria-hidden="true" />
                ) : (
                  <Heart size={16} aria-hidden="true" />
                )}
                Build &amp; save
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {generationError ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} aria-hidden="true" />
          <span>{generationError}</span>
        </div>
      ) : null}

      {coreLoading ? (
        <section className="today-recommendation-status" aria-busy="true" role="status">
          <SpinnerGap className="spin" size={30} aria-hidden="true" />
          <div>
            <h2>Loading your wardrobe…</h2>
            <p>
              Recent items and today’s recommendation controls will appear when loading finishes.
            </p>
          </div>
        </section>
      ) : generating ? (
        <section className="today-recommendation-status" aria-busy="true" role="status">
          <SpinnerGap className="spin" size={30} aria-hidden="true" />
          <div>
            <h2>Building today’s look…</h2>
            <p>The stylist is filtering your owned, available pieces against today’s context.</p>
          </div>
        </section>
      ) : recommendation ? (
        <section className="today-look today-look--live" aria-labelledby="today-look-title">
          <div className="today-look__art">
            <div className="today-look__label">
              <Badge tone={recommendation.savedOutfitId ? "sage" : "rust"}>
                {recommendation.savedOutfitId ? "Saved recommendation" : "Unsaved recommendation"}
              </Badge>
            </div>
            <div className="today-look__pieces today-look__pieces--live">
              {recommendation.items.map((selection) => {
                const item = recommendation.itemDetails[selection.item_id];
                if (!item) return null;
                return (
                  <Link
                    className="today-look__piece"
                    href={`/wardrobe/${selection.item_id}`}
                    key={selection.item_id}
                  >
                    <span className="today-look__piece-visual">
                      <ItemVisual item={item} role={selection.role} />
                    </span>
                    <span className="today-look__piece-copy">
                      <span>{readableToken(selection.role)}</span>
                      <strong>{item.name}</strong>
                      <small>
                        {[item.brand, item.subcategory ?? item.category]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      <code>{selection.item_id}</code>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="today-look__details">
            <p className="eyebrow">
              {recommendation.occasion ?? "Open day"}
              {recommendationWeather?.locationName
                ? ` · ${recommendationWeather.locationName}`
                : ""}
              {` · ${Math.round(recommendation.confidence * 100)}% confidence`}
            </p>
            <h2 id="today-look-title">{recommendation.title}</h2>
            <p className="today-look__summary">{recommendation.explanation}</p>
            {recommendation.preview ? (
              <div className="recommendation-preview">
                {recommendation.preview.styleTags.length ? (
                  <div className="recommendation-preview__tags">
                    {recommendation.preview.styleTags.map((tag) => (
                      <Badge key={tag} tone="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {previewImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Modeled preview of this outfit"
                    className="recommendation-preview__image"
                    src={previewImageUrl}
                  />
                ) : recommendation.preview.status === "queued" ||
                  recommendation.preview.status === "generating" ? (
                  <p className="recommendation-preview__status">Modeled preview is generating…</p>
                ) : recommendation.preview.status === "failed" ? (
                  <p className="recommendation-preview__status">The last preview attempt failed.</p>
                ) : (
                  <button
                    className="recommendation-preview__request"
                    disabled={previewRequestBusy}
                    onClick={() => void requestPreview()}
                    type="button"
                  >
                    {previewRequestBusy ? "Requesting…" : "Generate a modeled preview"}
                  </button>
                )}
                {previewNotice ? <small>{previewNotice}</small> : null}
              </div>
            ) : null}
            <ul className="today-look__reasons" aria-label="Recommendation reasons and warnings">
              {recommendationReasons.slice(0, 3).map((reason) => (
                <li key={reason}>
                  <CloudRain size={15} aria-hidden="true" /> {reason}
                </li>
              ))}
              <li>
                <Check size={15} weight="bold" aria-hidden="true" /> Every displayed item ID was
                re-verified against your wardrobe.
              </li>
              {recommendation.warnings.map((warning) => (
                <li key={warning}>
                  <WarningCircle size={15} aria-hidden="true" /> {warning}
                </li>
              ))}
            </ul>
            {recommendation.missingCategory ? (
              <p className="today-look__note">Missing category: {recommendation.missingCategory}</p>
            ) : null}
            {recommendation.followUpQuestion ? (
              <p className="today-look__note">{recommendation.followUpQuestion}</p>
            ) : null}
            {recommendation.excludedItemCount ? (
              <p className="today-look__note">
                {recommendation.excludedItemCount} owned
                {recommendation.excludedItemCount === 1 ? " item was" : " items were"} excluded by
                availability or context filters.
              </p>
            ) : null}
            <div className="today-look__actions">
              <Button
                disabled={Boolean(recommendation.savedOutfitId) || saving}
                onClick={() => void saveRecommendation()}
              >
                {saving ? (
                  <SpinnerGap className="spin" size={16} aria-hidden="true" />
                ) : recommendation.savedOutfitId ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Heart size={16} aria-hidden="true" />
                )}
                {recommendation.savedOutfitId ? "Saved" : "Save look"}
              </Button>
              <ButtonLink href="/outfits" variant="secondary">
                View outfits <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
            </div>
            {notice ? (
              <div
                className="inline-feedback inline-feedback--success today-look__notice"
                role="status"
              >
                <Check size={16} aria-hidden="true" />
                <span>{notice}</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          className="empty-state today-recommendation-empty"
          aria-labelledby="today-look-title"
        >
          <span className="empty-state__icon">
            <Sparkle size={25} weight="light" aria-hidden="true" />
          </span>
          <h2 id="today-look-title">
            {items.length ? "Ready for today’s context" : "Your wardrobe is empty"}
          </h2>
          <p>
            {items.length
              ? "Choose an occasion above to build a weather-aware look from exact owned item IDs."
              : "Add a few pieces manually or by photo before asking for a recommendation."}
          </p>
          {!items.length && !coreLoading ? (
            <div className="empty-state__action">
              <ButtonLink href="/wardrobe/import">Add clothes</ButtonLink>
            </div>
          ) : null}
        </section>
      )}

      <section>
        <SectionHeader
          title="Recently added"
          description="A quick way back to the pieces you are still getting to know."
          action={
            <ButtonLink href="/wardrobe" variant="ghost">
              View wardrobe <ArrowRight size={15} aria-hidden="true" />
            </ButtonLink>
          }
        />
        {coreLoading ? (
          <div className="recent-strip recent-strip--loading" aria-busy="true" role="status">
            <span>Loading recent wardrobe items…</span>
          </div>
        ) : recentItems.length ? (
          <div className="recent-strip recent-strip--live">
            {recentItems.map((item) => {
              const role = resolveWardrobeItemRole({
                layer_role: item.layerRole,
                category: item.category,
                subcategory: item.subcategory,
              });
              return (
                <article key={item.id}>
                  <Link href={`/wardrobe/${item.id}`}>
                    <span className="recent-strip__visual">
                      <ItemVisual compact item={item} role={role} />
                    </span>
                    <span className="recent-strip__copy">
                      <span>
                        {item.subcategory ?? item.category} · {readableToken(item.availability)}
                      </span>
                      <strong>{item.name}</strong>
                    </span>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="recent-strip-empty">
            <p>No owned items have been added yet.</p>
            <ButtonLink href="/wardrobe/import" variant="secondary">
              Add your first piece
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
