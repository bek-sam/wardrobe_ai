"use client";

import {
  ArrowRight,
  Check,
  CoatHanger,
  MapPin,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { SelectField, TextField } from "@/components/ui/FormField";

const styleOptions = [
  "Minimal",
  "Classic",
  "Smart casual",
  "Comfort-first",
  "Colorful",
  "Streetwear",
  "Athletic",
  "Modest",
];
const activityOptions = [
  "Work",
  "School",
  "Dinner",
  "Outdoors",
  "Travel",
  "Events",
  "Worship",
  "Gym",
];

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

function optionValue(option: string) {
  return option.toLowerCase().replaceAll(" ", "-");
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) return error.message;
  }
  return fallback;
}

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

export function OnboardingForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [homeLocation, setHomeLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [temperature, setTemperature] = useState("neutral");
  const [styles, setStyles] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(value: string, selected: string[], setSelected: (values: string[]) => void) {
    setSelected(
      selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await patchJson("/api/profile", {
        first_name: firstName.trim() || null,
        home_location_name: homeLocation.trim() || null,
        timezone,
        onboarding_completed_at: new Date().toISOString(),
      });
      await patchJson("/api/style-profile", {
        style_keywords: styles,
        common_activities: activities,
        runs_cold: temperature === "cold" ? true : null,
        runs_hot: temperature === "hot" ? true : null,
      });
      router.push("/wardrobe/import");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your choices could not be saved.");
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-page">
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
      <main className="onboarding-main">
        <section className="onboarding-intro">
          <p className="eyebrow">Step 2 of 3</p>
          <h1>
            Help your wardrobe
            <br />
            feel like yours.
          </h1>
          <p>
            Everything here is optional and editable later. We use it only to make recommendations
            more useful.
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
        <form className="onboarding-form" onSubmit={submit}>
          {!configured ? (
            <div className="form-section">
              <DemoNotice>
                Preview mode: configure Supabase to save this private style profile. You can still
                skip ahead and explore the interface.
              </DemoNotice>
            </div>
          ) : null}
          <div className="form-section">
            <div className="form-section__heading">
              <span>01</span>
              <div>
                <h2>Your basics</h2>
                <p>Enough context to get the forecast and fit right.</p>
              </div>
            </div>
            <div className="form-grid form-grid--two">
              <TextField
                disabled={!configured || saving}
                id="first-name"
                label="First name"
                maxLength={100}
                name="firstName"
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Your first name"
                value={firstName}
              />
              <TextField
                disabled={!configured || saving}
                id="home-location"
                label="Home location"
                maxLength={200}
                name="homeLocation"
                onChange={(event) => setHomeLocation(event.target.value)}
                placeholder="City or postal code"
                value={homeLocation}
              />
              <SelectField
                disabled={!configured || saving}
                id="timezone"
                label="Timezone"
                name="timezone"
                onChange={(event) => setTimezone(event.target.value)}
                value={timezone}
              >
                <option value="America/Chicago">Central Time</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </SelectField>
              <SelectField
                disabled={!configured || saving}
                id="temperature"
                label="I usually feel"
                name="temperature"
                onChange={(event) => setTemperature(event.target.value)}
                value={temperature}
              >
                <option value="cold">Cold before others do</option>
                <option value="neutral">Comfortable at expected temperatures</option>
                <option value="hot">Warm before others do</option>
              </SelectField>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section__heading">
              <span>02</span>
              <div>
                <h2>Your style</h2>
                <p>Choose any words that feel natural. There are no wrong answers.</p>
              </div>
            </div>
            <fieldset className="choice-fieldset" disabled={!configured || saving}>
              <legend className="sr-only">Style preferences</legend>
              <div className="choice-grid">
                {styleOptions.map((option) => {
                  const value = optionValue(option);
                  return (
                    <label className="choice-chip" key={option}>
                      <input
                        checked={styles.includes(value)}
                        name="style"
                        onChange={() => toggle(value, styles, setStyles)}
                        type="checkbox"
                        value={value}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="form-section">
            <div className="form-section__heading">
              <span>03</span>
              <div>
                <h2>Your everyday</h2>
                <p>What do you most often get dressed for?</p>
              </div>
            </div>
            <fieldset className="choice-fieldset" disabled={!configured || saving}>
              <legend className="sr-only">Common activities</legend>
              <div className="choice-grid">
                {activityOptions.map((option) => {
                  const value = option.toLowerCase();
                  return (
                    <label className="choice-chip" key={option}>
                      <input
                        checked={activities.includes(value)}
                        name="activity"
                        onChange={() => toggle(value, activities, setActivities)}
                        type="checkbox"
                        value={value}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
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
            <Button disabled={!configured || saving} type="submit">
              {saving ? <SpinnerGap className="spin" size={16} /> : null}
              {saving ? "Saving…" : "Save and add my first piece"}
              {!saving ? <ArrowRight size={16} /> : null}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
