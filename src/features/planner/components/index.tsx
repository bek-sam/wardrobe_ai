"use client";

import { CalendarBlank, Plus, Sparkle, Sun } from "@phosphor-icons/react";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { Button } from "@/components/ui";
import { DemoNotice } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { PreviewBadge } from "@/components/ui";
import { previewDays } from "./planner-model";
import { parseIsoDate } from "./planner-model";
import type { PlanView, WeatherView } from "./planner-model";
import { Badge } from "@/components/ui";
import { PencilSimple } from "@phosphor-icons/react";
import { artworkCategory } from "./planner-model";
import { temperatureLabel } from "./planner-model";
import { Cloud, CloudRain, Snowflake } from "@phosphor-icons/react";
import { useGenerateSubmit } from "./planner-model";
import type { GenerateDay } from "./planner-model";
import { X } from "@phosphor-icons/react";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { OutfitOption, PlanFormState } from "./planner-model";
import type { PlanEditorProps } from "./planner-model";
import { Check, Trash } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { requestJson } from "@/lib/api/request";
import { buildPlanPayload } from "./planner-model";
import type { Dispatch, SetStateAction } from "react";
import { shiftDate } from "./planner-model";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatWeekRange } from "./planner-model";
import type { PlannerToolbarProps } from "./planner-model";
import type { ProfileView } from "./planner-model";
import { plansByDateMap } from "./planner-model";
import { countLooks, countOpenDays, countRainyDays } from "./planner-model";
import { usePlannerWorkspaceState } from "./planner-model";

const previewWeekdays = ["Tue", "Wed", "Thu"];

function PreviewDayCard({
  weekday,
  dayOfMonth,
  occasion,
  colors,
}: {
  weekday: string;
  dayOfMonth: number;
  occasion: string;
  colors: readonly string[];
}) {
  return (
    <article className="day-card">
      <header>
        <div>
          <span>{weekday}</span>
          <strong>{dayOfMonth}</strong>
        </div>
        <div>
          <Sun size={18} /> <span>Sample</span>
        </div>
      </header>
      <div className="day-card__occasion">{occasion}</div>
      {colors.length ? (
        <div className="day-card__look">
          <div>
            {colors.map((color, pieceIndex) => (
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
  );
}

export function PreviewPlanner() {
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
          <PreviewDayCard
            colors={day.colors}
            dayOfMonth={21 + index}
            key={day.date}
            occasion={day.occasion}
            weekday={previewWeekdays[index]!}
          />
        ))}
      </section>
    </>
  );
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

function DayCardHeader({
  weekday,
  dayOfMonth,
  weather,
  temperatureUnit,
}: {
  weekday: string;
  dayOfMonth: number;
  weather: WeatherView | null;
  temperatureUnit: "celsius" | "fahrenheit";
}) {
  return (
    <header>
      <div>
        <span>{weekday}</span>
        <strong>{dayOfMonth}</strong>
      </div>
      <div title={weather ? `${weather.rainProbability ?? 0}% rain` : "Weather unavailable"}>
        <WeatherIcon weather={weather} />
        <span>{temperatureLabel(weather, temperatureUnit)}</span>
      </div>
    </header>
  );
}

function DayPlanEntry({ plan, onEdit }: { plan: PlanView; onEdit: () => void }) {
  return (
    <section className={`day-plan day-plan--${plan.status}`}>
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
      <strong>{plan.outfitName ?? plan.eventTitle ?? plan.occasion ?? "Planned day"}</strong>
      <small>
        {plan.startTime ? `${plan.startTime.slice(0, 5)} · ` : ""}
        {plan.status}
      </small>
      <button onClick={onEdit} type="button">
        <PencilSimple size={13} /> Edit
      </button>
    </section>
  );
}

function DayCardOccasionLine({ dayPlans, isToday }: { dayPlans: PlanView[]; isToday: boolean }) {
  return (
    <div className="day-card__occasion">
      <span>
        {dayPlans
          .map((plan) => plan.eventTitle ?? plan.occasion)
          .filter(Boolean)
          .join(" · ") || "Open day"}
      </span>
      {isToday ? <Badge tone="rust">Today</Badge> : null}
    </div>
  );
}

export function DayCard({
  date,
  isToday,
  dayPlans,
  weather,
  temperatureUnit,
  onEdit,
}: {
  date: string;
  isToday: boolean;
  dayPlans: PlanView[];
  weather: WeatherView | null;
  temperatureUnit: "celsius" | "fahrenheit";
  onEdit: (plan: PlanView | null) => void;
}) {
  const parsed = parseIsoDate(date);
  return (
    <article className={`day-card${isToday ? " is-today" : ""}`}>
      <DayCardHeader
        dayOfMonth={parsed.getDate()}
        temperatureUnit={temperatureUnit}
        weather={weather}
        weekday={new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed)}
      />
      <DayCardOccasionLine dayPlans={dayPlans} isToday={isToday} />
      {dayPlans.length ? (
        <div className="day-card__plans">
          {dayPlans.map((plan) => (
            <DayPlanEntry key={plan.id} onEdit={() => onEdit(plan)} plan={plan} />
          ))}
          <button className="day-card__add-plan" onClick={() => onEdit(null)} type="button">
            <Plus size={14} /> Add another
          </button>
        </div>
      ) : (
        <button className="day-card__empty" onClick={() => onEdit(null)} type="button">
          <Plus size={20} /> <span>Plan a look or occasion</span>
        </button>
      )}
    </article>
  );
}

function GenerateDayRow({
  day,
  onToggleSelected,
  onOccasion,
}: {
  day: GenerateDay;
  onToggleSelected: (selected: boolean) => void;
  onOccasion: (occasion: string) => void;
}) {
  return (
    <div className={day.selected ? "is-selected" : ""}>
      <label className="check-row">
        <input
          checked={day.selected}
          onChange={(event) => onToggleSelected(event.target.checked)}
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
        onChange={(event) => onOccasion(event.target.value)}
        placeholder="Occasion (optional)"
        value={day.occasion}
      />
    </div>
  );
}

function useGenerateDays(dates: string[], plans: PlanView[]) {
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

  function toggleSelected(index: number, selected: boolean) {
    setDays((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, selected } : entry)),
    );
  }

  function setOccasion(index: number, occasion: string) {
    setDays((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, occasion } : entry)),
    );
  }

  return { days, toggleSelected, setOccasion };
}

function GenerateDialogFooter({
  generating,
  error,
  canSubmit,
  onCancel,
}: {
  generating: boolean;
  error: string | null;
  canSubmit: boolean;
  onCancel: () => void;
}) {
  return (
    <>
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
        <Button disabled={generating} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={generating || !canSubmit} type="submit">
          {generating ? <SpinnerGap className="spin" size={15} /> : <Sparkle size={15} />}
          Generate &amp; save
        </Button>
      </div>
    </>
  );
}

function GenerateDialogHeader({ disabled, onClose }: { disabled: boolean; onClose: () => void }) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">Owned items only</p>
        <h2 id="generate-week-title">Plan selected days</h2>
      </div>
      <button
        aria-label="Close generator"
        className="icon-button"
        disabled={disabled}
        onClick={onClose}
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function GenerateDayList({
  days,
  onToggleSelected,
  onOccasion,
}: {
  days: GenerateDay[];
  onToggleSelected: (index: number, selected: boolean) => void;
  onOccasion: (index: number, occasion: string) => void;
}) {
  return (
    <div className="generate-day-list">
      {days.map((day, index) => (
        <GenerateDayRow
          day={day}
          key={day.date}
          onOccasion={(occasion) => onOccasion(index, occasion)}
          onToggleSelected={(selected) => onToggleSelected(index, selected)}
        />
      ))}
    </div>
  );
}

function GenerateLocationField({
  location,
  onLocation,
}: {
  location: string;
  onLocation: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>Location override</span>
      <input
        className="text-input"
        maxLength={160}
        onChange={(event) => onLocation(event.target.value)}
        placeholder="Blank uses your home location"
        value={location}
      />
    </label>
  );
}

export function GenerateDialog({
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
  const { days, toggleSelected, setOccasion } = useGenerateDays(dates, plans);
  const { location, setLocation, generating, error, submit } = useGenerateSubmit(days, onGenerated);
  const closeSafely = () => {
    if (!generating) onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="generate-week-title"
        aria-modal="true"
        className="planner-dialog planner-generate-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <GenerateDialogHeader disabled={generating} onClose={closeSafely} />
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <GenerateLocationField location={location} onLocation={setLocation} />
          <GenerateDayList days={days} onOccasion={setOccasion} onToggleSelected={toggleSelected} />
          <GenerateDialogFooter
            canSubmit={days.some((day) => day.selected)}
            error={error}
            generating={generating}
            onCancel={closeSafely}
          />
        </form>
      </section>
    </div>
  );
}

function PlanEditorLocationStatusFields({
  locationName,
  onLocationName,
  plan,
  status,
  onStatus,
}: {
  locationName: string;
  onLocationName: (value: string) => void;
  plan: PlanView | null;
  status: "planned" | "skipped";
  onStatus: (value: "planned" | "skipped") => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Location</span>
        <input
          className="text-input"
          maxLength={200}
          onChange={(event) => onLocationName(event.target.value)}
          placeholder="Use home location when blank"
          value={locationName}
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
              onChange={(event) => onStatus(event.target.value as "planned" | "skipped")}
              value={status}
            >
              <option value="planned">Planned</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
        )
      ) : null}
    </>
  );
}

function PlanEditorOutfitField({
  outfitId,
  onOutfitId,
  outfits,
}: {
  outfitId: string;
  onOutfitId: (value: string) => void;
  outfits: OutfitOption[];
}) {
  return (
    <label className="form-field">
      <span>Saved outfit</span>
      <select
        className="select-input"
        onChange={(event) => onOutfitId(event.target.value)}
        value={outfitId}
      >
        <option value="">Occasion only — no outfit yet</option>
        {outfits.map((outfit) => (
          <option key={outfit.id} value={outfit.id}>
            {outfit.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlanEditorOccasionFields({
  occasion,
  onOccasion,
  eventTitle,
  onEventTitle,
}: {
  occasion: string;
  onOccasion: (value: string) => void;
  eventTitle: string;
  onEventTitle: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <label className="form-field">
        <span>Occasion</span>
        <input
          className="text-input"
          maxLength={160}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="Office, dinner, outdoors…"
          value={occasion}
        />
      </label>
      <label className="form-field">
        <span>Event title</span>
        <input
          className="text-input"
          maxLength={200}
          onChange={(event) => onEventTitle(event.target.value)}
          placeholder="Client lunch"
          value={eventTitle}
        />
      </label>
    </div>
  );
}

function PlanEditorDateTimeFields({
  plannedDate,
  onPlannedDate,
  startTime,
  onStartTime,
}: {
  plannedDate: string;
  onPlannedDate: (value: string) => void;
  startTime: string;
  onStartTime: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <label className="form-field">
        <span>Date</span>
        <input
          className="text-input"
          onChange={(event) => onPlannedDate(event.target.value)}
          required
          type="date"
          value={plannedDate}
        />
      </label>
      <label className="form-field">
        <span>Start time</span>
        <input
          className="text-input"
          onChange={(event) => onStartTime(event.target.value)}
          type="time"
          value={startTime}
        />
      </label>
    </div>
  );
}

export function PlanEditorFields({
  form,
  setField,
  outfits,
  plan,
}: {
  form: PlanFormState;
  setField: <Key extends keyof PlanFormState>(key: Key, value: PlanFormState[Key]) => void;
  outfits: OutfitOption[];
  plan: PlanView | null;
}) {
  return (
    <>
      <PlanEditorDateTimeFields
        onPlannedDate={(value) => setField("plannedDate", value)}
        onStartTime={(value) => setField("startTime", value)}
        plannedDate={form.plannedDate}
        startTime={form.startTime}
      />
      <PlanEditorOutfitField
        onOutfitId={(value) => setField("outfitId", value)}
        outfitId={form.outfitId}
        outfits={outfits}
      />
      <PlanEditorOccasionFields
        eventTitle={form.eventTitle}
        occasion={form.occasion}
        onEventTitle={(value) => setField("eventTitle", value)}
        onOccasion={(value) => setField("occasion", value)}
      />
      <PlanEditorLocationStatusFields
        locationName={form.locationName}
        onLocationName={(value) => setField("locationName", value)}
        onStatus={(value) => setField("status", value)}
        plan={plan}
        status={form.status}
      />
    </>
  );
}

function usePlanDelete(
  plan: PlanView | null,
  onDeleted: () => void,
  setSaving: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string | null>>,
) {
  return async function deletePlan() {
    if (!plan || !window.confirm(`Delete the plan for ${plan.plannedDate}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson<unknown>(`/api/plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be deleted.");
    } finally {
      setSaving(false);
    }
  };
}

function usePlanEditorForm(
  date: string,
  plan: PlanView | null,
  onSaved: () => void,
  onDeleted: () => void,
) {
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
  const deletePlan = usePlanDelete(plan, onDeleted, setSaving, setError);

  function setField<Key extends keyof PlanFormState>(key: Key, value: PlanFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requestJson<unknown>(
        plan ? `/api/plans/${encodeURIComponent(plan.id)}` : "/api/plans",
        {
          method: plan ? "PATCH" : "POST",
          body: JSON.stringify(buildPlanPayload(form, plan)),
        },
      );
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return { form, setField, saving, error, submit, deletePlan };
}

function PlanEditorFooter({
  editing,
  saving,
  error,
  onDelete,
  onCancel,
}: {
  editing: boolean;
  saving: boolean;
  error: string | null;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
      <div className="planner-dialog__actions">
        {editing ? (
          <Button disabled={saving} onClick={onDelete} type="button" variant="danger">
            <Trash size={15} /> Delete
          </Button>
        ) : null}
        <span />
        <Button disabled={saving} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
          Save plan
        </Button>
      </div>
    </>
  );
}

function PlanEditorHeader({
  editing,
  disabled,
  onClose,
}: {
  editing: boolean;
  disabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">{editing ? "Update plan" : "Add context"}</p>
        <h2 id="plan-editor-title">{editing ? "Edit planned day" : "Plan a day"}</h2>
      </div>
      <button
        aria-label="Close plan editor"
        className="icon-button"
        disabled={disabled}
        onClick={onClose}
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export function PlanEditor({ date, plan, outfits, onClose, onSaved, onDeleted }: PlanEditorProps) {
  const { form, setField, saving, error, submit, deletePlan } = usePlanEditorForm(
    date,
    plan,
    onSaved,
    onDeleted,
  );
  const closeSafely = () => {
    if (!saving) onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="plan-editor-title"
        aria-modal="true"
        className="planner-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <PlanEditorHeader disabled={saving} editing={Boolean(plan)} onClose={closeSafely} />
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <PlanEditorFields form={form} outfits={outfits} plan={plan} setField={setField} />
          <PlanEditorFooter
            editing={Boolean(plan)}
            error={error}
            onCancel={closeSafely}
            onDelete={() => void deletePlan()}
            saving={saving}
          />
        </form>
      </section>
    </div>
  );
}

function PlannerNotices({
  aiConfigured,
  error,
  onRetry,
  notice,
  onDismissNotice,
}: {
  aiConfigured: boolean;
  error: string | null;
  onRetry: () => void;
  notice: string | null;
  onDismissNotice: () => void;
}) {
  return (
    <>
      {!aiConfigured ? (
        <DemoNotice>
          Your saved plans remain live and editable, but the OpenAI planner model is not configured.
          Week generation is disabled and no sample looks are shown as account data.
        </DemoNotice>
      ) : null}
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{error}</span>
          <Button onClick={onRetry} variant="ghost">
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
            onClick={onDismissNotice}
            type="button"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function PlannerToolbar({
  anchor,
  today,
  dates,
  loading,
  profile,
  onShift,
  onToday,
}: PlannerToolbarProps) {
  return (
    <div className="planner-toolbar">
      <button
        disabled={!anchor || loading}
        aria-label="Previous seven days"
        onClick={() => onShift(-7)}
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
        onClick={() => onShift(7)}
        type="button"
      >
        <CaretRight size={17} />
      </button>
      <Button disabled={!today || loading} onClick={onToday} variant="ghost">
        Today
      </Button>
    </div>
  );
}

function PlannerHeader({
  aiConfigured,
  canAddOccasion,
  onAddOccasion,
  canGenerate,
  onGenerate,
}: {
  aiConfigured: boolean;
  canAddOccasion: boolean;
  onAddOccasion: () => void;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  return (
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
          <Button disabled={!canAddOccasion} onClick={onAddOccasion} variant="secondary">
            <CalendarBlank size={16} /> Add occasion
          </Button>
          <Button disabled={!canGenerate} onClick={onGenerate}>
            <Sparkle size={16} /> Plan my week
          </Button>
        </>
      }
    />
  );
}

export function PlannerTopSection({
  state,
  aiConfigured,
}: {
  state: ReturnType<typeof usePlannerWorkspaceState>;
  aiConfigured: boolean;
}) {
  return (
    <>
      <PlannerHeader
        aiConfigured={aiConfigured}
        canAddOccasion={Boolean(state.dates.length)}
        canGenerate={aiConfigured && Boolean(state.dates.length) && !state.loading}
        onAddOccasion={() =>
          state.dates[0] && state.setEditor({ date: state.dates[0], plan: null })
        }
        onGenerate={() => state.setGeneratorOpen(true)}
      />
      <PlannerNotices
        aiConfigured={aiConfigured}
        error={state.error}
        notice={state.notice}
        onDismissNotice={() => state.setNotice(null)}
        onRetry={() => state.setRefresh((value) => value + 1)}
      />
      <PlannerToolbar
        anchor={state.anchor}
        dates={state.dates}
        loading={state.loading}
        onShift={(days) => state.setAnchor((current) => shiftDate(current, days))}
        onToday={() => state.setAnchor(state.today)}
        profile={state.profile}
        today={state.today}
      />
    </>
  );
}

export function PlannerWeekGrid({
  dates,
  today,
  plansByDate,
  forecast,
  profile,
  onEdit,
}: {
  dates: string[];
  today: string;
  plansByDate: Map<string, PlanView[]>;
  forecast: Map<string, WeatherView>;
  profile: ProfileView;
  onEdit: (date: string, plan: PlanView | null) => void;
}) {
  return (
    <section className="week-grid" aria-label="Seven-day outfit plan">
      {dates.map((date) => (
        <DayCard
          date={date}
          dayPlans={plansByDate.get(date) ?? []}
          isToday={date === today}
          key={date}
          onEdit={(plan) => onEdit(date, plan)}
          temperatureUnit={profile.temperatureUnit}
          weather={forecast.get(date) ?? null}
        />
      ))}
    </section>
  );
}

function PlannerWeekSkeleton() {
  return (
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
  );
}

function PlannerEmptyState() {
  return (
    <section className="empty-state planner-empty-state">
      <span className="empty-state__icon">
        <CalendarBlank size={24} />
      </span>
      <h2>No plans in these seven days</h2>
      <p>
        Add an occasion manually, or let the planner build saved looks from owned, available pieces.
      </p>
    </section>
  );
}

export function PlannerWeekBody({
  state,
  onEdit,
}: {
  state: ReturnType<typeof usePlannerWorkspaceState>;
  onEdit: (date: string, plan: PlanView | null) => void;
}) {
  const plansByDate = plansByDateMap(state.dates, state.plans);
  if (state.loading) return <PlannerWeekSkeleton />;
  return (
    <>
      <PlannerWeekGrid
        dates={state.dates}
        forecast={state.forecast}
        onEdit={onEdit}
        plansByDate={plansByDate}
        profile={state.profile}
        today={state.today}
      />
      {!state.plans.length ? <PlannerEmptyState /> : null}
    </>
  );
}

function PlannerDialogs({ state }: { state: ReturnType<typeof usePlannerWorkspaceState> }) {
  return (
    <>
      {state.editor ? (
        <PlanEditor
          date={state.editor.date}
          onClose={() => state.setEditor(null)}
          onDeleted={() => {
            state.setEditor(null);
            state.setNotice("Plan deleted.");
            state.setRefresh((value) => value + 1);
          }}
          onSaved={() => {
            state.setEditor(null);
            state.setNotice("Plan saved.");
            state.setRefresh((value) => value + 1);
          }}
          outfits={state.outfits}
          plan={state.editor.plan}
        />
      ) : null}
      {state.generatorOpen ? (
        <GenerateDialog
          dates={state.dates}
          onClose={() => state.setGeneratorOpen(false)}
          onGenerated={(message) => {
            state.setGeneratorOpen(false);
            state.setNotice(message);
            state.setRefresh((value) => value + 1);
          }}
          plans={state.plans}
        />
      ) : null}
    </>
  );
}

function PlannerSummary({
  lookCount,
  planCount,
  rainyDays,
  openDays,
  aiConfigured,
  onFillOpenDays,
}: {
  lookCount: number;
  planCount: number;
  rainyDays: number;
  openDays: number;
  aiConfigured: boolean;
  onFillOpenDays: () => void;
}) {
  return (
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
          {planCount} {planCount === 1 ? "plan" : "plans"}
        </li>
        <li>
          <span />
          {openDays} open {openDays === 1 ? "day" : "days"}
        </li>
      </ul>
      <Button disabled={!aiConfigured || !openDays} onClick={onFillOpenDays} variant="secondary">
        Fill open days
      </Button>
    </section>
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
  const state = usePlannerWorkspaceState(initialDate, supabaseConfigured);

  if (!supabaseConfigured) return <PreviewPlanner />;

  const plansByDate = plansByDateMap(state.dates, state.plans);
  const openDays = countOpenDays(state.dates, plansByDate);

  return (
    <>
      <PlannerTopSection aiConfigured={aiConfigured} state={state} />
      <PlannerWeekBody onEdit={(date, plan) => state.setEditor({ date, plan })} state={state} />
      <PlannerSummary
        aiConfigured={aiConfigured}
        lookCount={countLooks(state.plans)}
        onFillOpenDays={() => state.setGeneratorOpen(true)}
        openDays={openDays}
        planCount={state.plans.length}
        rainyDays={countRainyDays(state.dates, state.forecast)}
      />
      <PlannerDialogs state={state} />
    </>
  );
}
