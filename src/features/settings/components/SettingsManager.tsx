"use client";

import {
  Bell,
  CheckCircle,
  CoatHanger,
  DownloadSimple,
  GearSix,
  LockKey,
  MapPin,
  SpinnerGap,
  Trash,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { SelectField, TextareaField, TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

type Profile = {
  id: string;
  first_name: string | null;
  display_name: string | null;
  home_location_name: string | null;
  timezone: string;
  temperature_unit: "celsius" | "fahrenheit";
  locale: string;
};

type StyleProfile = {
  style_keywords: string[];
  favorite_colors: string[];
  avoided_colors: string[];
  preferred_fits: string[];
  preferred_formality: number | null;
  runs_cold: boolean | null;
  runs_hot: boolean | null;
  modesty_preferences: Record<string, unknown>;
  size_profile: Record<string, unknown>;
  common_activities: string[];
  notes: string;
};

type Notice = { tone: "error" | "success"; message: string };

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
const timezoneOptions = [
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
];

function optionValue(option: string) {
  return option.toLowerCase().replaceAll(" ", "-");
}

function commaSeparated(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

function objectString(value: Record<string, unknown> | undefined, key: string) {
  const entry = value?.[key];
  return typeof entry === "string" ? entry : "";
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) return error.message;
  }
  return fallback;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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

function scrollTo(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SettingsManager({ configured }: { configured: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("en-US");
  const [homeLocation, setHomeLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [temperatureUnit, setTemperatureUnit] = useState<"celsius" | "fahrenheit">("fahrenheit");
  const [styles, setStyles] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState("");
  const [avoidedColors, setAvoidedColors] = useState("");
  const [preferredFits, setPreferredFits] = useState("");
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");
  const [dressSize, setDressSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [coverageNotes, setCoverageNotes] = useState("");
  const [formality, setFormality] = useState("");
  const [temperatureComfort, setTemperatureComfort] = useState("neutral");
  const [styleNote, setStyleNote] = useState("");
  const [loading, setLoading] = useState(configured);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [retry, setRetry] = useState(0);
  const [activeSection, setActiveSection] = useState("settings-profile");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setNotice(null);
      Promise.all([
        requestJson<Profile>("/api/profile", { signal: controller.signal }),
        requestJson<StyleProfile | null>("/api/style-profile", { signal: controller.signal }),
      ])
        .then(([nextProfile, nextStyle]) => {
          setProfile(nextProfile);
          setFirstName(nextProfile.first_name ?? "");
          setDisplayName(nextProfile.display_name ?? "");
          setLocale(nextProfile.locale || "en-US");
          setHomeLocation(nextProfile.home_location_name ?? "");
          setTimezone(nextProfile.timezone || "America/Chicago");
          setTemperatureUnit(nextProfile.temperature_unit || "fahrenheit");
          setStyles(nextStyle?.style_keywords ?? []);
          setActivities(nextStyle?.common_activities ?? []);
          setFavoriteColors((nextStyle?.favorite_colors ?? []).join(", "));
          setAvoidedColors((nextStyle?.avoided_colors ?? []).join(", "));
          setPreferredFits((nextStyle?.preferred_fits ?? []).join(", "));
          setTopSize(objectString(nextStyle?.size_profile, "top"));
          setBottomSize(objectString(nextStyle?.size_profile, "bottom"));
          setDressSize(objectString(nextStyle?.size_profile, "dress"));
          setShoeSize(objectString(nextStyle?.size_profile, "shoes"));
          setCoverageNotes(objectString(nextStyle?.modesty_preferences, "notes"));
          setFormality(nextStyle?.preferred_formality?.toString() ?? "");
          setTemperatureComfort(
            nextStyle?.runs_cold ? "cold" : nextStyle?.runs_hot ? "hot" : "neutral",
          );
          setStyleNote(nextStyle?.notes ?? "");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : "Settings could not be loaded.",
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [configured, retry]);

  const disabled = !configured || loading || busy !== null || profile === null;

  const save = useCallback(async (key: string, path: string, body: Record<string, unknown>) => {
    setBusy(key);
    setNotice(null);
    try {
      const result = await requestJson<Profile | StyleProfile>(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setNotice({ tone: "success", message: "Your settings were saved." });
      return result;
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your settings could not be saved.",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  function toggle(value: string, selected: string[], setSelected: (values: string[]) => void) {
    setSelected(
      selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value],
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save("profile", "/api/profile", {
      first_name: firstName.trim() || null,
      display_name: displayName.trim() || null,
      locale,
    });
    if (result)
      setProfile((current) => (current ? { ...current, ...(result as Profile) } : current));
  }

  async function saveStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("style", "/api/style-profile", {
      style_keywords: styles,
      common_activities: activities,
      favorite_colors: commaSeparated(favoriteColors),
      avoided_colors: commaSeparated(avoidedColors),
      preferred_fits: commaSeparated(preferredFits),
      preferred_formality: formality ? Number(formality) : null,
      runs_cold: temperatureComfort === "cold" ? true : null,
      runs_hot: temperatureComfort === "hot" ? true : null,
      size_profile: {
        ...(topSize.trim() ? { top: topSize.trim() } : {}),
        ...(bottomSize.trim() ? { bottom: bottomSize.trim() } : {}),
        ...(dressSize.trim() ? { dress: dressSize.trim() } : {}),
        ...(shoeSize.trim() ? { shoes: shoeSize.trim() } : {}),
      },
      modesty_preferences: coverageNotes.trim() ? { notes: coverageNotes.trim() } : {},
      notes: styleNote.trim(),
    });
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save("location", "/api/profile", {
      home_location_name: homeLocation.trim() || null,
      timezone,
      temperature_unit: temperatureUnit,
    });
    if (result)
      setProfile((current) => (current ? { ...current, ...(result as Profile) } : current));
  }

  async function exportData() {
    setBusy("export");
    setNotice(null);
    try {
      const response = await fetch("/api/account/export", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(errorMessage(payload, "Your export could not be prepared."));
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "wardrobe-ai-export.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice({ tone: "success", message: "Your private data export was downloaded." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your export could not be prepared.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!profile || deletePhrase !== "DELETE" || !deletePassword) return;
    if (
      !window.confirm(
        "Permanently delete this account, all wardrobe data, and associated private files? This cannot be undone.",
      )
    ) {
      return;
    }
    setBusy("delete");
    setNotice(null);
    try {
      await requestJson<{ deleted: true }>("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: profile.id, password: deletePassword }),
      });
      window.location.assign("/");
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The account could not be deleted.",
      });
      setDeletePassword("");
      setBusy(null);
    }
  }

  const timezoneIsKnown = timezoneOptions.some((option) => option.value === timezone);
  const openSection = (sectionId: string) => {
    setActiveSection(sectionId);
    scrollTo(sectionId);
  };

  return (
    <div className="page-stack settings-page">
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        description="Control the context, preferences, and privacy choices Wardrobe AI can use."
      />
      {!configured ? (
        <DemoNotice>
          Preview mode: configure Supabase to load and securely save account settings. All controls
          below are disabled.
        </DemoNotice>
      ) : null}
      {notice ? (
        <div
          className={`inline-feedback inline-feedback--${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "error" ? <WarningCircle size={17} /> : <CheckCircle size={17} />}
          <span>{notice.message}</span>
          {notice.tone === "error" && !loading ? (
            <Button onClick={() => setRetry((value) => value + 1)} variant="ghost">
              Reload
            </Button>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div className="inline-feedback" role="status">
          <SpinnerGap className="spin" size={17} />
          <span>Loading your private settings…</span>
        </div>
      ) : null}
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          <button
            className={activeSection === "settings-profile" ? "is-active" : ""}
            onClick={() => openSection("settings-profile")}
            type="button"
          >
            <User size={18} /> Profile
          </button>
          <button
            className={activeSection === "settings-style" ? "is-active" : ""}
            onClick={() => openSection("settings-style")}
            type="button"
          >
            <CoatHanger size={18} /> Style & sizes
          </button>
          <button
            className={activeSection === "settings-location" ? "is-active" : ""}
            onClick={() => openSection("settings-location")}
            type="button"
          >
            <MapPin size={18} /> Location
          </button>
          <button disabled title="Notification preferences are not available yet" type="button">
            <Bell size={18} /> Notifications
          </button>
          <button
            className={activeSection === "settings-privacy" ? "is-active" : ""}
            onClick={() => openSection("settings-privacy")}
            type="button"
          >
            <LockKey size={18} /> Privacy & data
          </button>
        </nav>
        <div className="settings-content">
          <Card as="section" className="settings-section" id="settings-profile">
            <div className="settings-section__heading">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Your details</h2>
                <p>Used for greetings and account communication—not style inference.</p>
              </div>
              <span className="settings-avatar" aria-hidden="true">
                <User size={26} weight="light" />
              </span>
            </div>
            <form onSubmit={saveProfile}>
              <div className="form-grid form-grid--two">
                <TextField
                  disabled={disabled}
                  id="settings-first-name"
                  label="First name"
                  maxLength={100}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Your first name"
                  value={firstName}
                />
                <TextField
                  disabled={disabled}
                  id="settings-display-name"
                  label="Display name"
                  maxLength={160}
                  onChange={(event) => setDisplayName(event.target.value)}
                  optional
                  placeholder="How your name appears"
                  value={displayName}
                />
                <TextField
                  id="settings-email"
                  label="Email address"
                  placeholder="Managed by your secure sign-in"
                  readOnly
                  type="email"
                />
                <SelectField
                  disabled={disabled}
                  id="settings-locale"
                  label="Language"
                  onChange={(event) => setLocale(event.target.value)}
                  value={locale}
                >
                  {!["en-US", "en-GB"].includes(locale) ? (
                    <option value={locale}>{locale}</option>
                  ) : null}
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </SelectField>
              </div>
              <div className="settings-form-actions">
                <Button disabled={disabled} type="submit">
                  {busy === "profile" ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </Card>

          <Card as="section" className="settings-section" id="settings-style">
            <div className="settings-section__heading">
              <div>
                <p className="eyebrow">Style profile</p>
                <h2>How you like to dress</h2>
                <p>Explicit preferences take priority over inferred patterns.</p>
              </div>
              <Badge tone="outline">Optional</Badge>
            </div>
            <form onSubmit={saveStyle}>
              <fieldset className="settings-fieldset" disabled={disabled}>
                <legend>Style words</legend>
                <div className="choice-grid">
                  {styleOptions.map((option) => {
                    const value = optionValue(option);
                    return (
                      <label className="choice-chip" key={option}>
                        <input
                          checked={styles.includes(value)}
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
              <fieldset className="settings-fieldset" disabled={disabled}>
                <legend>Common activities</legend>
                <div className="choice-grid">
                  {activityOptions.map((option) => {
                    const value = option.toLowerCase();
                    return (
                      <label className="choice-chip" key={option}>
                        <input
                          checked={activities.includes(value)}
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
              <div className="form-grid form-grid--two">
                <SelectField
                  disabled={disabled}
                  id="settings-formality"
                  label="Typical formality"
                  onChange={(event) => setFormality(event.target.value)}
                  value={formality}
                >
                  <option value="">No preference</option>
                  <option value="1">Very casual</option>
                  <option value="2">Mostly casual</option>
                  <option value="3">Balanced</option>
                  <option value="4">Usually polished</option>
                  <option value="5">Formal</option>
                </SelectField>
                <SelectField
                  disabled={disabled}
                  id="settings-temperature-comfort"
                  label="Temperature comfort"
                  onChange={(event) => setTemperatureComfort(event.target.value)}
                  value={temperatureComfort}
                >
                  <option value="cold">I run cold</option>
                  <option value="neutral">Neutral</option>
                  <option value="hot">I run hot</option>
                </SelectField>
              </div>
              <div className="form-grid form-grid--two">
                <TextField
                  disabled={disabled}
                  id="settings-favorite-colors"
                  label="Favorite colors"
                  onChange={(event) => setFavoriteColors(event.target.value)}
                  optional
                  placeholder="navy, cream, rust"
                  value={favoriteColors}
                />
                <TextField
                  disabled={disabled}
                  id="settings-avoided-colors"
                  label="Colors to avoid"
                  onChange={(event) => setAvoidedColors(event.target.value)}
                  optional
                  placeholder="neon yellow, bright orange"
                  value={avoidedColors}
                />
                <TextField
                  disabled={disabled}
                  hint="Comma-separated; for example relaxed, straight, oversized."
                  id="settings-preferred-fits"
                  label="Preferred fits"
                  onChange={(event) => setPreferredFits(event.target.value)}
                  optional
                  value={preferredFits}
                />
              </div>
              <fieldset className="settings-fieldset" disabled={disabled}>
                <legend>Sizes</legend>
                <div className="form-grid form-grid--two">
                  <TextField
                    id="settings-size-top"
                    label="Tops"
                    onChange={(event) => setTopSize(event.target.value)}
                    optional
                    value={topSize}
                  />
                  <TextField
                    id="settings-size-bottom"
                    label="Bottoms"
                    onChange={(event) => setBottomSize(event.target.value)}
                    optional
                    value={bottomSize}
                  />
                  <TextField
                    id="settings-size-dress"
                    label="Dresses"
                    onChange={(event) => setDressSize(event.target.value)}
                    optional
                    value={dressSize}
                  />
                  <TextField
                    id="settings-size-shoes"
                    label="Shoes"
                    onChange={(event) => setShoeSize(event.target.value)}
                    optional
                    value={shoeSize}
                  />
                </div>
              </fieldset>
              <TextareaField
                disabled={disabled}
                id="settings-coverage-notes"
                label="Coverage or modesty preferences"
                maxLength={1_000}
                onChange={(event) => setCoverageNotes(event.target.value)}
                optional
                placeholder="Only preferences you explicitly want the stylist to use."
                rows={3}
                value={coverageNotes}
              />
              <TextareaField
                disabled={disabled}
                id="settings-style-note"
                label="Anything else the stylist should respect"
                maxLength={2_000}
                onChange={(event) => setStyleNote(event.target.value)}
                optional
                placeholder="Coverage, sensory comfort, workplace dress code, or other preferences…"
                rows={4}
                value={styleNote}
              />
              <div className="settings-form-actions">
                <Button disabled={disabled} type="submit">
                  {busy === "style" ? "Saving…" : "Save style profile"}
                </Button>
              </div>
            </form>
          </Card>

          <Card as="section" className="settings-section" id="settings-location">
            <div className="settings-section__heading">
              <div>
                <p className="eyebrow">Weather context</p>
                <h2>Location & units</h2>
                <p>Used only to retrieve weather for the dates and places you request.</p>
              </div>
              <MapPin size={22} />
            </div>
            <form onSubmit={saveLocation}>
              <div className="form-grid form-grid--two">
                <TextField
                  disabled={disabled}
                  id="settings-location"
                  label="Home location"
                  maxLength={200}
                  onChange={(event) => setHomeLocation(event.target.value)}
                  placeholder="City or postal code"
                  value={homeLocation}
                />
                <SelectField
                  disabled={disabled}
                  id="settings-timezone"
                  label="Timezone"
                  onChange={(event) => setTimezone(event.target.value)}
                  value={timezone}
                >
                  {!timezoneIsKnown ? <option value={timezone}>{timezone}</option> : null}
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  disabled={disabled}
                  id="settings-temperature-unit"
                  label="Temperature"
                  onChange={(event) =>
                    setTemperatureUnit(event.target.value as "celsius" | "fahrenheit")
                  }
                  value={temperatureUnit}
                >
                  <option value="fahrenheit">Fahrenheit</option>
                  <option value="celsius">Celsius</option>
                </SelectField>
              </div>
              <div className="settings-form-actions">
                <Button disabled={disabled} type="submit">
                  {busy === "location" ? "Saving…" : "Save location settings"}
                </Button>
              </div>
            </form>
          </Card>

          <Card as="section" className="settings-section" id="settings-privacy">
            <div className="settings-section__heading">
              <div>
                <p className="eyebrow">AI & privacy</p>
                <h2>Your controls</h2>
                <p>Sensitive or expensive capabilities are always opt-in.</p>
              </div>
              <Badge tone="outline">Not stored yet</Badge>
            </div>
            <div className="toggle-list">
              {[
                [
                  "Allow product research",
                  "Research runs only when requested and always shows sources.",
                ],
                [
                  "Modeled preview consent",
                  "Private modeled previews require a future consent-backed setting.",
                ],
                [
                  "Preference learning",
                  "Editable learned-preference controls are planned for a later release.",
                ],
              ].map(([label, description]) => (
                <label className="toggle-row" key={label}>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <input disabled role="switch" type="checkbox" />
                </label>
              ))}
            </div>
            <div className="settings-form-actions">
              <Link href="/privacy">Read the privacy policy</Link>
            </div>
          </Card>

          <Card as="section" className="settings-section settings-section--data">
            <div className="settings-section__heading">
              <div>
                <p className="eyebrow">Data ownership</p>
                <h2>Export or delete</h2>
                <p>Download your data or permanently remove this account.</p>
              </div>
              <GearSix size={22} />
            </div>
            <div className="data-action">
              <span>
                <DownloadSimple size={20} />
              </span>
              <div>
                <strong>Export your data</strong>
                <p>
                  Download wardrobe metadata, preferences, outfits, plans, and image references.
                </p>
              </div>
              <Button disabled={disabled} onClick={() => void exportData()} variant="secondary">
                {busy === "export" ? "Preparing…" : "Request export"}
              </Button>
            </div>
            <div className="data-action data-action--danger">
              <span>
                <Trash size={20} />
              </span>
              <div>
                <strong>Delete account</strong>
                <p>Permanently remove account rows and associated private files.</p>
              </div>
              <Button disabled={disabled} onClick={() => setDeleteOpen(true)} variant="danger">
                Delete account
              </Button>
            </div>
            {deleteOpen ? (
              <div
                className="account-delete-confirmation"
                role="group"
                aria-label="Confirm account deletion"
              >
                <p>
                  This cannot be undone. Type <strong>DELETE</strong>, confirm your password, then
                  confirm once more in your browser.
                </p>
                <TextField
                  autoComplete="off"
                  disabled={busy === "delete"}
                  id="delete-account-confirmation"
                  label="Deletion confirmation"
                  onChange={(event) => setDeletePhrase(event.target.value)}
                  value={deletePhrase}
                />
                <TextField
                  autoComplete="current-password"
                  disabled={busy === "delete"}
                  id="delete-account-password"
                  label="Current password"
                  onChange={(event) => setDeletePassword(event.target.value)}
                  type="password"
                  value={deletePassword}
                />
                <div className="settings-form-actions">
                  <Button
                    disabled={deletePhrase !== "DELETE" || !deletePassword || busy === "delete"}
                    onClick={() => void deleteAccount()}
                    variant="danger"
                  >
                    {busy === "delete" ? "Deleting…" : "Permanently delete account"}
                  </Button>
                  <Button
                    disabled={busy === "delete"}
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeletePhrase("");
                      setDeletePassword("");
                    }}
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
