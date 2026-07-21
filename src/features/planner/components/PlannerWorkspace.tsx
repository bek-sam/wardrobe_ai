"use client";

import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  Cloud,
  CloudRain,
  PencilSimple,
  Plus,
  Snowflake,
  Sparkle,
  SpinnerGap,
  Sun,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Badge, PreviewBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OutfitItemRole } from "@/features/outfits/types";
import {
  GarmentArtwork,
  type GarmentCategory,
} from "@/features/wardrobe/components/GarmentArtwork";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

type WeatherView = {
  minimumC: number | null;
  maximumC: number | null;
  rainProbability: number | null;
  snowfallCm: number | null;
  weatherCode: number | null;
};

type PlanItem = {
  id: string;
  name: string;
  role: OutfitItemRole;
  primaryColor: string | null;
  secondaryColor: string | null;
};

type PlanView = {
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

type OutfitOption = { id: string; name: string };

type ProfileView = {
  locationName: string | null;
  temperatureUnit: "celsius" | "fahrenheit";
};

type PlanFormState = {
  plannedDate: string;
  outfitId: string;
  startTime: string;
  occasion: string;
  locationName: string;
  eventTitle: string;
  status: "planned" | "skipped";
};

type GenerateDay = { date: string; selected: boolean; occasion: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set<OutfitItemRole>(["top", "bottom", "dress", "layer", "shoes", "accessory"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    throw new Error(errorMessage(payload, `The request failed (${response.status}).`));
  }
  return payload.data;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeNumber(value: unknown, minimum?: number, maximum?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (minimum !== undefined && value < minimum) return null;
  if (maximum !== undefined && value > maximum) return null;
  return value;
}

function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function weatherFrom(value: unknown): WeatherView | null {
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

function relationObject(value: unknown) {
  if (Array.isArray(value)) return isObject(value[0]) ? value[0] : null;
  return isObject(value) ? value : null;
}

function normalizePlan(value: unknown): PlanView | null {
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
    items,
  };
}

function normalizeProfile(value: unknown): ProfileView {
  if (!isObject(value)) return { locationName: null, temperatureUnit: "celsius" };
  return {
    locationName: safeNullableString(value.home_location_name),
    temperatureUnit: value.temperature_unit === "fahrenheit" ? "fahrenheit" : "celsius",
  };
}

function normalizeOutfitOptions(value: unknown): OutfitOption[] {
  if (!isObject(value) || !Array.isArray(value.outfits)) return [];
  return value.outfits
    .filter((entry): entry is Record<string, unknown> => isObject(entry))
    .flatMap((entry) => {
      const id = safeString(entry.id);
      return uuidPattern.test(id) ? [{ id, name: safeString(entry.name, "Saved outfit") }] : [];
    });
}

function artworkCategory(role: OutfitItemRole): GarmentCategory {
  if (role === "bottom") return "bottom";
  if (role === "dress") return "dress";
  if (role === "layer") return "layer";
  if (role === "shoes") return "shoes";
  if (role === "accessory") return "accessory";
  return "top";
}

function temperature(valueC: number, unit: "celsius" | "fahrenheit") {
  return unit === "fahrenheit" ? Math.round((valueC * 9) / 5 + 32) : Math.round(valueC);
}

function temperatureLabel(weather: WeatherView | null, unit: "celsius" | "fahrenheit") {
  if (!weather) return "—";
  const suffix = unit === "fahrenheit" ? "°F" : "°C";
  if (weather.minimumC !== null && weather.maximumC !== null) {
    return `${temperature(weather.minimumC, unit)}–${temperature(weather.maximumC, unit)}${suffix}`;
  }
  const one = weather.maximumC ?? weather.minimumC;
  return one === null ? "—" : `${temperature(one, unit)}${suffix}`;
}

function WeatherIcon({ weather }: { weather: WeatherView | null }) {
  if (!weather) return <Cloud size={18} />;
  const code = weather.weatherCode;
  const snowCode = code !== null && [71, 73, 75, 77, 85, 86].includes(code);
  const precipitationCode = code !== null && ((code >= 51 && code <= 67) || code >= 80);
  if ((weather.snowfallCm ?? 0) > 0 || snowCode) return <Snowflake size={18} />;
  if ((weather.rainProbability ?? 0) >= 35 || precipitationCode) return <CloudRain size={18} />;
  if (code !== null && code > 0) return <Cloud size={18} />;
  return <Sun size={18} />;
}

function formatWeekRange(dates: string[]) {
  if (!dates.length) return "Seven-day plan";
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const first = formatter.format(parseIsoDate(dates[0]!));
  const lastDate = parseIsoDate(dates[dates.length - 1]!);
  const last = formatter.format(lastDate);
  return `${first}–${last}, ${lastDate.getFullYear()}`;
}

const previewDays = [
  { date: "2026-07-21", occasion: "Client lunch", colors: ["#ddd4c2", "#293647", "#9c7250"] },
  { date: "2026-07-22", occasion: "Office", colors: ["#455746", "#d8d0bf", "#c9bca3"] },
  { date: "2026-07-23", occasion: "Open day", colors: [] },
] as const;

function PreviewPlanner() {
  return (
    <>
      <PageHeader
        eyebrow="Seven-day view"
        title="Outfit planner"
        description="Plan around your week, the forecast, and what will actually be available."
        meta={<PreviewBadge />}
        actions={
          <>
            <Button disabled variant="secondary">
              <CalendarBlank size={16} /> Add occasion
            </Button>
            <Button disabled>
              <Sparkle size={16} /> Plan my week
            </Button>
          </>
        }
      />
      <DemoNotice>
        This is an explicitly labeled planning preview because Supabase is not configured.
        Forecasts, occasions, and looks below are illustrative and are not saved.
      </DemoNotice>
      <section className="week-grid week-grid--preview" aria-label="Sample weekly outfit plan">
        {previewDays.map((day, index) => (
          <article className="day-card" key={day.date}>
            <header>
              <div>
                <span>{["Tue", "Wed", "Thu"][index]}</span>
                <strong>{21 + index}</strong>
              </div>
              <div>
                <Sun size={18} /> <span>Sample</span>
              </div>
            </header>
            <div className="day-card__occasion">{day.occasion}</div>
            {day.colors.length ? (
              <div className="day-card__look">
                <div>
                  {day.colors.map((color, pieceIndex) => (
                    <GarmentArtwork
                      category={pieceIndex === 0 ? "top" : pieceIndex === 1 ? "bottom" : "layer"}
                      color={color}
                      compact
                      key={color}
                    />
                  ))}
                </div>
                <strong>Sample look</strong>
              </div>
            ) : (
              <button className="day-card__empty" disabled type="button">
                <Plus size={20} /> <span>Preview only</span>
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}

function PlanEditor({
  date,
  plan,
  outfits,
  onClose,
  onSaved,
  onDeleted,
}: {
  date: string;
  plan: PlanView | null;
  outfits: OutfitOption[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<PlanFormState>({
    plannedDate: plan?.plannedDate ?? date,
    outfitId: plan?.outfitId ?? "",
    startTime: plan?.startTime?.slice(0, 5) ?? "",
    occasion: plan?.occasion ?? "",
    locationName: plan?.locationName ?? "",
    eventTitle: plan?.eventTitle ?? "",
    status: plan?.status === "skipped" ? "skipped" : "planned",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<Key extends keyof PlanFormState>(key: Key, value: PlanFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const common = {
        outfit_id: form.outfitId || null,
        planned_date: form.plannedDate,
        start_time: form.startTime || null,
        occasion: form.occasion.trim() || null,
        location_name: form.locationName.trim() || null,
        event_title: form.eventTitle.trim() || null,
      };
      await requestJson<unknown>(
        plan ? `/api/plans/${encodeURIComponent(plan.id)}` : "/api/plans",
        {
          method: plan ? "PATCH" : "POST",
          body: JSON.stringify(
            plan
              ? {
                  ...common,
                  ...(plan.status === "worn" ? {} : { status: form.status }),
                }
              : { ...common, weather_snapshot: null, status: "planned" },
          ),
        },
      );
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    if (!plan || !window.confirm(`Delete the plan for ${plan.plannedDate}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson<unknown>(`/api/plans/${encodeURIComponent(plan.id)}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  function closeSafely() {
    if (!saving) onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="plan-editor-title"
        aria-modal="true"
        className="planner-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="item-form-dialog__header">
          <div>
            <p className="eyebrow">{plan ? "Update plan" : "Add context"}</p>
            <h2 id="plan-editor-title">{plan ? "Edit planned day" : "Plan a day"}</h2>
          </div>
          <button
            aria-label="Close plan editor"
            className="icon-button"
            disabled={saving}
            onClick={closeSafely}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <div className="form-grid form-grid--two">
            <label className="form-field">
              <span>Date</span>
              <input
                className="text-input"
                onChange={(event) => setField("plannedDate", event.target.value)}
                required
                type="date"
                value={form.plannedDate}
              />
            </label>
            <label className="form-field">
              <span>Start time</span>
              <input
                className="text-input"
                onChange={(event) => setField("startTime", event.target.value)}
                type="time"
                value={form.startTime}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Saved outfit</span>
            <select
              className="select-input"
              onChange={(event) => setField("outfitId", event.target.value)}
              value={form.outfitId}
            >
              <option value="">Occasion only — no outfit yet</option>
              {outfits.map((outfit) => (
                <option key={outfit.id} value={outfit.id}>
                  {outfit.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid form-grid--two">
            <label className="form-field">
              <span>Occasion</span>
              <input
                className="text-input"
                maxLength={160}
                onChange={(event) => setField("occasion", event.target.value)}
                placeholder="Office, dinner, outdoors…"
                value={form.occasion}
              />
            </label>
            <label className="form-field">
              <span>Event title</span>
              <input
                className="text-input"
                maxLength={200}
                onChange={(event) => setField("eventTitle", event.target.value)}
                placeholder="Client lunch"
                value={form.eventTitle}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Location</span>
            <input
              className="text-input"
              maxLength={200}
              onChange={(event) => setField("locationName", event.target.value)}
              placeholder="Use home location when blank"
              value={form.locationName}
            />
          </label>
          {plan ? (
            plan.status === "worn" ? (
              <p className="form-field__hint">Worn status is historical and will be preserved.</p>
            ) : (
              <label className="form-field">
                <span>Status</span>
                <select
                  className="select-input"
                  onChange={(event) =>
                    setField("status", event.target.value as "planned" | "skipped")
                  }
                  value={form.status}
                >
                  <option value="planned">Planned</option>
                  <option value="skipped">Skipped</option>
                </select>
              </label>
            )
          ) : null}
          {error ? (
            <p className="inline-feedback inline-feedback--error" role="alert">
              <WarningCircle size={16} /> {error}
            </p>
          ) : null}
          <div className="planner-dialog__actions">
            {plan ? (
              <Button
                disabled={saving}
                onClick={() => void deletePlan()}
                type="button"
                variant="danger"
              >
                <Trash size={15} /> Delete
              </Button>
            ) : null}
            <span />
            <Button disabled={saving} onClick={closeSafely} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
              Save plan
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function GenerateDialog({
  dates,
  plans,
  onClose,
  onGenerated,
}: {
  dates: string[];
  plans: PlanView[];
  onClose: () => void;
  onGenerated: (message: string) => void;
}) {
  const [days, setDays] = useState<GenerateDay[]>(() =>
    dates.map((date) => {
      const dayPlans = plans.filter((plan) => plan.plannedDate === date);
      const hasOutfit = dayPlans.some((plan) => plan.outfitId && plan.status !== "skipped");
      return {
        date,
        selected: !hasOutfit,
        occasion: dayPlans.find((plan) => plan.occasion)?.occasion ?? "",
      };
    }),
  );
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
      if (!isObject(result) || !Array.isArray(result.looks) || !Array.isArray(result.saved)) {
        throw new Error("The generated plan response was invalid.");
      }
      const missing = Array.isArray(result.missingCategories)
        ? result.missingCategories.filter((entry): entry is string => typeof entry === "string")
        : [];
      onGenerated(
        `${result.saved.length} ${result.saved.length === 1 ? "look" : "looks"} planned${
          missing.length ? `. Missing categories: ${missing.join(", ")}.` : "."
        }`,
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The week could not be generated.");
    } finally {
      controllerRef.current = null;
      setGenerating(false);
    }
  }

  function closeSafely() {
    if (!generating) onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="generate-week-title"
        aria-modal="true"
        className="planner-dialog planner-generate-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="item-form-dialog__header">
          <div>
            <p className="eyebrow">Owned items only</p>
            <h2 id="generate-week-title">Plan selected days</h2>
          </div>
          <button
            aria-label="Close generator"
            className="icon-button"
            disabled={generating}
            onClick={closeSafely}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <label className="form-field">
            <span>Location override</span>
            <input
              className="text-input"
              maxLength={160}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Blank uses your home location"
              value={location}
            />
          </label>
          <div className="generate-day-list">
            {days.map((day, index) => (
              <div className={day.selected ? "is-selected" : ""} key={day.date}>
                <label className="check-row">
                  <input
                    checked={day.selected}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, selected: event.target.checked }
                            : entry,
                        ),
                      )
                    }
                    type="checkbox"
                  />
                  <strong>
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    }).format(parseIsoDate(day.date))}
                  </strong>
                </label>
                <input
                  aria-label={`Occasion for ${day.date}`}
                  className="text-input"
                  disabled={!day.selected}
                  maxLength={120}
                  onChange={(event) =>
                    setDays((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, occasion: event.target.value } : entry,
                      ),
                    )
                  }
                  placeholder="Occasion (optional)"
                  value={day.occasion}
                />
              </div>
            ))}
          </div>
          {generating ? (
            <p className="inline-feedback" role="status">
              <SpinnerGap className="spin" size={16} /> Building and validating each selected day…
            </p>
          ) : null}
          {error ? (
            <p className="inline-feedback inline-feedback--error" role="alert">
              <WarningCircle size={16} /> {error}
            </p>
          ) : null}
          <div className="planner-dialog__actions">
            <span />
            <span />
            <Button disabled={generating} onClick={closeSafely} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={generating || !days.some((day) => day.selected)} type="submit">
              {generating ? <SpinnerGap className="spin" size={15} /> : <Sparkle size={15} />}
              Generate &amp; save
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function PlannerWorkspace({
  supabaseConfigured,
  aiConfigured,
  initialDate,
}: {
  supabaseConfigured: boolean;
  aiConfigured: boolean;
  initialDate: string;
}) {
  const [anchor, setAnchor] = useState(initialDate);
  const [today] = useState(initialDate);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [outfits, setOutfits] = useState<OutfitOption[]>([]);
  const [profile, setProfile] = useState<ProfileView>({
    locationName: null,
    temperatureUnit: "celsius",
  });
  const [forecast, setForecast] = useState<Map<string, WeatherView>>(new Map());
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{ date: string; plan: PlanView | null } | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const weekAbortRef = useRef<AbortController | null>(null);

  const dates = useMemo(
    () => (anchor ? Array.from({ length: 7 }, (_, index) => shiftDate(anchor, index)) : []),
    [anchor],
  );

  const loadWeek = useCallback(async () => {
    if (!supabaseConfigured || !dates.length) return;
    weekAbortRef.current?.abort();
    const controller = new AbortController();
    weekAbortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ from: dates[0]!, to: dates[6]!, limit: "100" });
      const [planResult, outfitResult, profileResult] = await Promise.all([
        requestJson<unknown>(`/api/plans?${query}`, { signal: controller.signal }),
        requestJson<unknown>("/api/outfits?limit=100", { signal: controller.signal }),
        requestJson<unknown>("/api/profile", { signal: controller.signal }),
      ]);
      const rawPlans =
        isObject(planResult) && Array.isArray(planResult.plans) ? planResult.plans : [];
      const basePlans = rawPlans
        .map(normalizePlan)
        .filter((plan): plan is PlanView => Boolean(plan));
      const detailed = await Promise.all(
        basePlans.map(async (plan) => {
          try {
            const detail = await requestJson<unknown>(`/api/plans/${encodeURIComponent(plan.id)}`, {
              signal: controller.signal,
            });
            return normalizePlan(detail) ?? plan;
          } catch {
            return plan;
          }
        }),
      );
      if (controller.signal.aborted) return;
      setPlans(detailed);
      setOutfits(normalizeOutfitOptions(outfitResult));
      setProfile(normalizeProfile(profileResult));
      const weatherEntries = await Promise.all(
        dates.map(async (date) => {
          const persisted = detailed.find(
            (plan) => plan.plannedDate === date && plan.weather,
          )?.weather;
          if (persisted) return [date, persisted] as const;
          const plannedLocation = detailed.find(
            (plan) => plan.plannedDate === date && plan.locationName,
          )?.locationName;
          try {
            const weatherQuery = new URLSearchParams({ date });
            if (plannedLocation) weatherQuery.set("location", plannedLocation);
            const raw = await requestJson<unknown>(`/api/weather?${weatherQuery.toString()}`, {
              signal: controller.signal,
            });
            return [date, weatherFrom(raw)] as const;
          } catch {
            return [date, null] as const;
          }
        }),
      );
      if (controller.signal.aborted) return;
      setForecast(
        new Map(
          weatherEntries.filter(
            (entry): entry is readonly [string, WeatherView] => entry[1] !== null,
          ),
        ),
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The planner could not be loaded.");
    } finally {
      if (weekAbortRef.current === controller) {
        weekAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [dates, supabaseConfigured]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWeek(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadWeek, refresh]);

  useEffect(() => () => weekAbortRef.current?.abort(), []);

  if (!supabaseConfigured) return <PreviewPlanner />;

  const plansByDate = new Map(
    dates.map((date) => [date, plans.filter((plan) => plan.plannedDate === date)]),
  );
  const lookCount = plans.filter((plan) => plan.outfitId && plan.status === "planned").length;
  const rainyDays = dates.filter((date) => (forecast.get(date)?.rainProbability ?? 0) >= 35).length;
  const openDays = dates.filter(
    (date) =>
      !(plansByDate.get(date) ?? []).some((plan) => plan.outfitId && plan.status !== "skipped"),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Seven-day view"
        title="Outfit planner"
        description="Plan around your week, the forecast, and what will actually be available."
        meta={
          <Badge tone={aiConfigured ? "sage" : "outline"}>
            {aiConfigured ? "Live plans" : "AI disabled"}
          </Badge>
        }
        actions={
          <>
            <Button
              disabled={!dates.length}
              onClick={() => dates[0] && setEditor({ date: dates[0], plan: null })}
              variant="secondary"
            >
              <CalendarBlank size={16} /> Add occasion
            </Button>
            <Button
              disabled={!aiConfigured || !dates.length || loading}
              onClick={() => setGeneratorOpen(true)}
            >
              <Sparkle size={16} /> Plan my week
            </Button>
          </>
        }
      />
      {!aiConfigured ? (
        <DemoNotice>
          Your saved plans remain live and editable, but the OpenAI planner model is not configured.
          Week generation is disabled and no sample looks are shown as account data.
        </DemoNotice>
      ) : null}
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{error}</span>
          <Button onClick={() => setRefresh((value) => value + 1)} variant="ghost">
            Try again
          </Button>
        </div>
      ) : null}
      {notice ? (
        <div className="inline-feedback inline-feedback--success" role="status">
          <Check size={16} /> <span>{notice}</span>
          <button
            aria-label="Dismiss message"
            className="icon-button icon-button--small"
            onClick={() => setNotice(null)}
            type="button"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
      <div className="planner-toolbar">
        <button
          disabled={!anchor || loading}
          aria-label="Previous seven days"
          onClick={() => setAnchor(shiftDate(anchor, -7))}
          type="button"
        >
          <CaretLeft size={17} />
        </button>
        <div>
          <strong>{formatWeekRange(dates)}</strong>
          <span>
            {profile.locationName ?? "Home location not set"} ·{" "}
            {profile.temperatureUnit === "fahrenheit" ? "Fahrenheit" : "Celsius"}
          </span>
        </div>
        <button
          disabled={!anchor || loading}
          aria-label="Next seven days"
          onClick={() => setAnchor(shiftDate(anchor, 7))}
          type="button"
        >
          <CaretRight size={17} />
        </button>
        <Button disabled={!today || loading} onClick={() => setAnchor(today)} variant="ghost">
          Today
        </Button>
      </div>
      {loading ? (
        <section
          className="week-grid planner-week-loading"
          aria-busy="true"
          aria-label="Loading outfit plans"
        >
          {Array.from({ length: 7 }, (_, index) => (
            <article className="day-card" key={index}>
              <span className="planner-skeleton planner-skeleton--date" />
              <span className="planner-skeleton planner-skeleton--occasion" />
              <span className="planner-skeleton planner-skeleton--look" />
            </article>
          ))}
        </section>
      ) : (
        <section className="week-grid" aria-label="Seven-day outfit plan">
          {dates.map((date) => {
            const dayPlans = plansByDate.get(date) ?? [];
            const weather = forecast.get(date) ?? null;
            const parsed = parseIsoDate(date);
            return (
              <article className={`day-card${date === today ? " is-today" : ""}`} key={date}>
                <header>
                  <div>
                    <span>
                      {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed)}
                    </span>
                    <strong>{parsed.getDate()}</strong>
                  </div>
                  <div
                    title={
                      weather ? `${weather.rainProbability ?? 0}% rain` : "Weather unavailable"
                    }
                  >
                    <WeatherIcon weather={weather} />
                    <span>{temperatureLabel(weather, profile.temperatureUnit)}</span>
                  </div>
                </header>
                <div className="day-card__occasion">
                  <span>
                    {dayPlans
                      .map((plan) => plan.eventTitle ?? plan.occasion)
                      .filter(Boolean)
                      .join(" · ") || "Open day"}
                  </span>
                  {date === today ? <Badge tone="rust">Today</Badge> : null}
                </div>
                {dayPlans.length ? (
                  <div className="day-card__plans">
                    {dayPlans.map((plan) => (
                      <section className={`day-plan day-plan--${plan.status}`} key={plan.id}>
                        {plan.items.length ? (
                          <div className="day-plan__pieces">
                            {plan.items.map((item) => (
                              <GarmentArtwork
                                category={artworkCategory(item.role)}
                                color={item.primaryColor ?? "#9c968b"}
                                accent={item.secondaryColor ?? undefined}
                                compact
                                key={item.id}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="day-plan__no-look">
                            <CalendarBlank size={18} /> Occasion only
                          </span>
                        )}
                        <strong>
                          {plan.outfitName ?? plan.eventTitle ?? plan.occasion ?? "Planned day"}
                        </strong>
                        <small>
                          {plan.startTime ? `${plan.startTime.slice(0, 5)} · ` : ""}
                          {plan.status}
                        </small>
                        <button onClick={() => setEditor({ date, plan })} type="button">
                          <PencilSimple size={13} /> Edit
                        </button>
                      </section>
                    ))}
                    <button
                      className="day-card__add-plan"
                      onClick={() => setEditor({ date, plan: null })}
                      type="button"
                    >
                      <Plus size={14} /> Add another
                    </button>
                  </div>
                ) : (
                  <button
                    className="day-card__empty"
                    onClick={() => setEditor({ date, plan: null })}
                    type="button"
                  >
                    <Plus size={20} /> <span>Plan a look or occasion</span>
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}
      {!loading && !plans.length ? (
        <section className="empty-state planner-empty-state">
          <span className="empty-state__icon">
            <CalendarBlank size={24} />
          </span>
          <h2>No plans in these seven days</h2>
          <p>
            Add an occasion manually, or let the planner build saved looks from owned, available
            pieces.
          </p>
        </section>
      ) : null}
      <section className="planner-summary">
        <div>
          <span className="planner-summary__icon">
            <Sparkle size={22} weight="light" />
          </span>
          <div>
            <h2>Week at a glance</h2>
            <p>
              {lookCount} saved {lookCount === 1 ? "look" : "looks"} across this seven-day window.
            </p>
          </div>
        </div>
        <ul>
          <li>
            <span />
            {rainyDays} rainy {rainyDays === 1 ? "day" : "days"}
          </li>
          <li>
            <span />
            {plans.length} {plans.length === 1 ? "plan" : "plans"}
          </li>
          <li>
            <span />
            {openDays} open {openDays === 1 ? "day" : "days"}
          </li>
        </ul>
        <Button
          disabled={!aiConfigured || !openDays}
          onClick={() => setGeneratorOpen(true)}
          variant="secondary"
        >
          Fill open days
        </Button>
      </section>
      {editor ? (
        <PlanEditor
          date={editor.date}
          onClose={() => setEditor(null)}
          onDeleted={() => {
            setEditor(null);
            setNotice("Plan deleted.");
            setRefresh((value) => value + 1);
          }}
          onSaved={() => {
            setEditor(null);
            setNotice("Plan saved.");
            setRefresh((value) => value + 1);
          }}
          outfits={outfits}
          plan={editor.plan}
        />
      ) : null}
      {generatorOpen ? (
        <GenerateDialog
          dates={dates}
          onClose={() => setGeneratorOpen(false)}
          onGenerated={(message) => {
            setGeneratorOpen(false);
            setNotice(message);
            setRefresh((value) => value + 1);
          }}
          plans={plans}
        />
      ) : null}
    </>
  );
}
