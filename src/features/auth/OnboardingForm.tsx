"use client";

import { toggleSelection } from "@/features/settings";
import { DemoNotice } from "@/components/ui";
import { Check } from "@phosphor-icons/react";
import Link from "next/link";
import { BrandMark } from "@/components/ui";
import { CoatHanger, MapPin, ShieldCheck } from "@phosphor-icons/react";
import { ChoiceFieldset } from "@/features/settings/components";
import { activityOptions } from "@/features/settings";
import { ArrowRight, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { optionValue } from "@/features/settings";
import { styleOptions } from "@/features/settings";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/api/request";
import { TextField } from "@/components/ui";
import { SelectField } from "@/components/ui";

function OnboardingTimezoneTempFields({
  disabled,
  timezone,
  onTimezone,
  temperature,
  onTemperature,
}: {
  disabled: boolean;
  timezone: string;
  onTimezone: (value: string) => void;
  temperature: string;
  onTemperature: (value: string) => void;
}) {
  return (
    <>
      <SelectField
        disabled={disabled}
        id="timezone"
        label="Timezone"
        name="timezone"
        onChange={(event) => onTimezone(event.target.value)}
        value={timezone}
      >
        <option value="America/Chicago">Central Time</option>
        <option value="America/New_York">Eastern Time</option>
        <option value="America/Denver">Mountain Time</option>
        <option value="America/Los_Angeles">Pacific Time</option>
      </SelectField>
      <SelectField
        disabled={disabled}
        id="temperature"
        label="I usually feel"
        name="temperature"
        onChange={(event) => onTemperature(event.target.value)}
        value={temperature}
      >
        <option value="cold">Cold before others do</option>
        <option value="neutral">Comfortable at expected temperatures</option>
        <option value="hot">Warm before others do</option>
      </SelectField>
    </>
  );
}

function OnboardingNameLocationFields({
  disabled,
  firstName,
  onFirstName,
  homeLocation,
  onHomeLocation,
}: {
  disabled: boolean;
  firstName: string;
  onFirstName: (value: string) => void;
  homeLocation: string;
  onHomeLocation: (value: string) => void;
}) {
  return (
    <>
      <TextField
        disabled={disabled}
        id="first-name"
        label="First name"
        maxLength={100}
        name="firstName"
        onChange={(event) => onFirstName(event.target.value)}
        placeholder="Your first name"
        value={firstName}
      />
      <TextField
        disabled={disabled}
        id="home-location"
        label="Home location"
        maxLength={200}
        name="homeLocation"
        onChange={(event) => onHomeLocation(event.target.value)}
        placeholder="City or postal code"
        value={homeLocation}
      />
    </>
  );
}

function OnboardingSectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="form-section__heading">
      <span>{step}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function OnboardingBasicsSection({
  disabled,
  firstName,
  onFirstName,
  homeLocation,
  onHomeLocation,
  timezone,
  onTimezone,
  temperature,
  onTemperature,
}: {
  disabled: boolean;
  firstName: string;
  onFirstName: (value: string) => void;
  homeLocation: string;
  onHomeLocation: (value: string) => void;
  timezone: string;
  onTimezone: (value: string) => void;
  temperature: string;
  onTemperature: (value: string) => void;
}) {
  return (
    <div className="form-section">
      <OnboardingSectionHeading
        description="Enough context to get the forecast and fit right."
        step="01"
        title="Your basics"
      />
      <div className="form-grid form-grid--two">
        <OnboardingNameLocationFields
          disabled={disabled}
          firstName={firstName}
          homeLocation={homeLocation}
          onFirstName={onFirstName}
          onHomeLocation={onHomeLocation}
        />
        <OnboardingTimezoneTempFields
          disabled={disabled}
          onTemperature={onTemperature}
          onTimezone={onTimezone}
          temperature={temperature}
          timezone={timezone}
        />
      </div>
    </div>
  );
}

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

async function patchJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, "Your onboarding choices could not be saved."));
  }
  return payload.data;
}

async function submitOnboarding(form: {
  firstName: string;
  homeLocation: string;
  timezone: string;
  temperature: string;
  styles: string[];
  activities: string[];
}) {
  await patchJson("/api/profile", {
    first_name: form.firstName.trim() || null,
    home_location_name: form.homeLocation.trim() || null,
    timezone: form.timezone,
    onboarding_completed_at: new Date().toISOString(),
  });
  await patchJson("/api/style-profile", {
    style_keywords: form.styles,
    common_activities: form.activities,
    runs_cold: form.temperature === "cold" ? true : null,
    runs_hot: form.temperature === "hot" ? true : null,
  });
}

function useOnboardingForm(configured: boolean) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [homeLocation, setHomeLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [temperature, setTemperature] = useState("neutral");
  const [styles, setStyles] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const values = { firstName, homeLocation, timezone, temperature, styles, activities };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await submitOnboarding(values);
      router.push("/wardrobe/import");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your choices could not be saved.");
      setSaving(false);
    }
  }

  return {
    firstName,
    setFirstName,
    homeLocation,
    setHomeLocation,
    timezone,
    setTimezone,
    temperature,
    setTemperature,
    styles,
    setStyles,
    activities,
    setActivities,
    saving,
    message,
    submit,
  };
}

function OnboardingStyleSection({
  disabled,
  styles,
  onToggle,
}: {
  disabled: boolean;
  styles: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="form-section">
      <div className="form-section__heading">
        <span>02</span>
        <div>
          <h2>Your style</h2>
          <p>Choose any words that feel natural. There are no wrong answers.</p>
        </div>
      </div>
      <ChoiceFieldset
        disabled={disabled}
        legend="Style preferences"
        legendClassName="sr-only"
        onToggle={onToggle}
        options={styleOptions}
        selected={styles}
        valueFor={optionValue}
      />
    </div>
  );
}

function OnboardingFormFooter({
  message,
  disabled,
  saving,
}: {
  message: string | null;
  disabled: boolean;
  saving: boolean;
}) {
  return (
    <>
      {message ? (
        <div className="form-section">
          <div className="inline-feedback inline-feedback--error" role="alert">
            <WarningCircle size={17} />
            <span>{message}</span>
          </div>
        </div>
      ) : null}
      <div className="onboarding-form__actions">
        <p>By continuing, you can review these choices anytime in Settings.</p>
        <Button disabled={disabled} type="submit">
          {saving ? <SpinnerGap className="spin" size={16} /> : null}
          {saving ? "Saving…" : "Save and add my first piece"}
          {!saving ? <ArrowRight size={16} /> : null}
        </Button>
      </div>
    </>
  );
}

function OnboardingActivitySection({
  disabled,
  activities,
  onToggle,
}: {
  disabled: boolean;
  activities: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="form-section">
      <div className="form-section__heading">
        <span>03</span>
        <div>
          <h2>Your everyday</h2>
          <p>What do you most often get dressed for?</p>
        </div>
      </div>
      <ChoiceFieldset
        disabled={disabled}
        legend="Common activities"
        legendClassName="sr-only"
        onToggle={onToggle}
        options={activityOptions}
        selected={activities}
        valueFor={(option) => option.toLowerCase()}
      />
    </div>
  );
}

function OnboardingIntro() {
  return (
    <section className="onboarding-intro">
      <p className="eyebrow">Step 2 of 3</p>
      <h1>
        Help your wardrobe
        <br />
        feel like yours.
      </h1>
      <p>
        Everything here is optional and editable later. We use it only to make recommendations more
        useful.
      </p>
      <ul>
        <li>
          <ShieldCheck size={18} /> You control every preference
        </li>
        <li>
          <CoatHanger size={18} /> Your answers improve outfit choices
        </li>
        <li>
          <MapPin size={18} /> Location powers local weather context
        </li>
      </ul>
    </section>
  );
}

function OnboardingHeader() {
  return (
    <header className="onboarding-header">
      <BrandMark />
      <div className="onboarding-progress" aria-label="Onboarding progress">
        <span className="is-complete">
          <Check size={12} weight="bold" />
        </span>
        <span className="is-current">2</span>
        <span>3</span>
        <small>Style profile</small>
      </div>
      <Link href="/today">Skip for now</Link>
    </header>
  );
}

function OnboardingDemoNotice({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <div className="form-section">
      <DemoNotice>
        Preview mode: configure Supabase to save this private style profile. You can still skip
        ahead and explore the interface.
      </DemoNotice>
    </div>
  );
}

export function OnboardingForm({ configured }: { configured: boolean }) {
  const form = useOnboardingForm(configured);
  const disabled = !configured || form.saving;

  return (
    <div className="onboarding-page">
      <OnboardingHeader />
      <main className="onboarding-main">
        <OnboardingIntro />
        <form className="onboarding-form" onSubmit={form.submit}>
          <OnboardingDemoNotice configured={configured} />
          <OnboardingBasicsSection
            disabled={disabled}
            firstName={form.firstName}
            homeLocation={form.homeLocation}
            onFirstName={form.setFirstName}
            onHomeLocation={form.setHomeLocation}
            onTemperature={form.setTemperature}
            onTimezone={form.setTimezone}
            temperature={form.temperature}
            timezone={form.timezone}
          />
          <OnboardingStyleSection
            disabled={disabled}
            onToggle={(value) => toggleSelection(value, form.styles, form.setStyles)}
            styles={form.styles}
          />
          <OnboardingActivitySection
            activities={form.activities}
            disabled={disabled}
            onToggle={(value) => toggleSelection(value, form.activities, form.setActivities)}
          />
          <OnboardingFormFooter disabled={disabled} message={form.message} saving={form.saving} />
        </form>
      </main>
    </div>
  );
}
