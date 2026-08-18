import { requestJson } from "@/lib/api/request";
import { uploadSignedFile } from "@/lib/api/signed-upload";
import { useCallback, useEffect, useState } from "react";
import type { AccountSecurity } from "@/features/settings";
import { errorMessage } from "@/lib/api/request";
import type { FormEvent } from "react";
import { toggleSelection } from "@/features/settings";

export function commaSeparated(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

export function objectString(value: Record<string, unknown> | undefined, key: string) {
  const entry = value?.[key];
  return typeof entry === "string" ? entry : "";
}

export function scrollTo(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export type Profile = {
  id: string;
  first_name: string | null;
  display_name: string | null;
  home_location_name: string | null;
  timezone: string;
  temperature_unit: "celsius" | "fahrenheit";
  locale: string;
  modeled_preview_consent: boolean;
  identity_reference_path: string | null;
};

export type SignedUpload = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  requiredContentType: string;
  maximumFileSize: number;
};

export type StyleProfile = {
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

export type Notice = { tone: "error" | "success"; message: string };

export type PrivacySectionProps = {
  identityReferencePath: string | null;
  modeledPreviewConsent: boolean;
  previewConsentBusy: boolean;
  disabled: boolean;
  onToggleConsent: () => void;
  onUpload: (file: File) => void;
};

export type DataOwnershipSectionProps = {
  disabled: boolean;
  busy: string | null;
  onExport: () => void;
  deleteOpen: boolean;
  onOpenDelete: () => void;
  deletePhrase: string;
  onDeletePhrase: (value: string) => void;
  deletePassword: string;
  onDeletePassword: (value: string) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  /**
   * Whether the account actually has a password identity. Drives which
   * reauthentication the deletion form asks for — an "email claim" is not
   * evidence of a password, and Google-only accounts have no password to type.
   */
  hasPassword: boolean;
  onReauthenticate: () => void;
};

export type ProfileFormState = { firstName: string; displayName: string; locale: string };

export type StyleFormState = {
  styles: string[];
  activities: string[];
  favoriteColors: string;
  avoidedColors: string;
  preferredFits: string;
  topSize: string;
  bottomSize: string;
  dressSize: string;
  shoeSize: string;
  coverageNotes: string;
  formality: string;
  temperatureComfort: string;
  styleNote: string;
};

export type LocationFormState = {
  homeLocation: string;
  timezone: string;
  temperatureUnit: "celsius" | "fahrenheit";
};

export function hydrateProfileForm(profile: Profile): ProfileFormState {
  return {
    firstName: profile.first_name ?? "",
    displayName: profile.display_name ?? "",
    locale: profile.locale || "en-US",
  };
}

export function hydrateLocationForm(profile: Profile): LocationFormState {
  return {
    homeLocation: profile.home_location_name ?? "",
    timezone: profile.timezone || "America/Chicago",
    temperatureUnit: profile.temperature_unit || "fahrenheit",
  };
}

export function hydrateStyleForm(style: StyleProfile | null): StyleFormState {
  return {
    styles: style?.style_keywords ?? [],
    activities: style?.common_activities ?? [],
    favoriteColors: (style?.favorite_colors ?? []).join(", "),
    avoidedColors: (style?.avoided_colors ?? []).join(", "),
    preferredFits: (style?.preferred_fits ?? []).join(", "),
    topSize: objectString(style?.size_profile, "top"),
    bottomSize: objectString(style?.size_profile, "bottom"),
    dressSize: objectString(style?.size_profile, "dress"),
    shoeSize: objectString(style?.size_profile, "shoes"),
    coverageNotes: objectString(style?.modesty_preferences, "notes"),
    formality: style?.preferred_formality?.toString() ?? "",
    temperatureComfort: style?.runs_cold ? "cold" : style?.runs_hot ? "hot" : "neutral",
    styleNote: style?.notes ?? "",
  };
}

/**
 * Provisioning material for a new TOTP factor.
 *
 * Held in component state for the duration of the enrollment only. It is never
 * written to our database, never logged, and there is no route that can read it
 * back — once the page is left, the secret exists only in the user's
 * authenticator app.
 */
export type MfaEnrollmentData = {
  factor_id: string;
  /** SVG markup from Supabase, rendered via a data URI rather than injected. */
  qr_code: string;
  secret: string;
};

export async function uploadIdentityReferenceFile(file: File): Promise<Profile> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 20 MB.");
  }
  const signed = await requestJson<SignedUpload>("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "profile-reference",
      fileName: file.name || "identity-reference.jpg",
      contentType: file.type,
      fileSize: file.size,
    }),
  });
  if (file.size > signed.maximumFileSize || signed.requiredContentType !== file.type) {
    throw new Error("The selected file does not match the signed upload requirements.");
  }
  await uploadSignedFile(signed.signedUrl, file, signed.requiredContentType);

  return requestJson<Profile>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ identity_reference_path: signed.path }),
  });
}

/**
 * Loads the account's security state.
 *
 * Refetched after every mutation rather than patched locally: enrolling a
 * factor, changing an email, or unlinking an identity each change several
 * derived flags at once (assurance level, which methods can still recover the
 * account), and a stale local copy would offer controls that no longer apply.
 */
export function useAccountSecurity(configured: boolean) {
  const [account, setAccount] = useState<AccountSecurity | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      setAccount(await requestJson<AccountSecurity>("/api/account/security"));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your security settings.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    // Deferred to a task so the first load does not set state during the
    // effect body, which would trigger a cascading render.
    const timeout = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timeout);
  }, [reload]);

  return { account, loading, error, reload };
}

type DeletionResult = { storage_objects_queued: number; storage_complete: boolean };

async function deleteAccountRequest(
  profile: Profile,
  deletePassword: string,
): Promise<DeletionResult> {
  return requestJson<DeletionResult>("/api/account", {
    method: "DELETE",
    // Empty for Google-only and passwordless accounts; those authorize with
    // the one-time challenge established by the reauthentication round trip.
    body: JSON.stringify({ confirmation: profile.id, password: deletePassword }),
  });
}

/**
 * Starts the provider round trip for an account with no password. Returns a
 * URL when the user must be sent to Google, or null when a one-time email link
 * was sent instead.
 */
async function startDeletionReauthentication(): Promise<string | null> {
  const result = await requestJson<{ method: string; redirect_url: string | null }>(
    "/api/account/reauthenticate",
    { method: "POST" },
  );
  return result.redirect_url;
}

function confirmAccountDeletion(): boolean {
  return window.confirm(
    "Permanently delete this account, all wardrobe data, and associated private files? This cannot be undone.",
  );
}

function deleteAccountErrorNotice(error: unknown): Notice {
  return {
    tone: "error",
    message: error instanceof Error ? error.message : "The account could not be deleted.",
  };
}

type DeleteAccountInput = {
  profile: Profile | null;
  deletePhrase: string;
  deletePassword: string;
  setDeletePassword: (value: string) => void;
  setBusy: (value: string | null) => void;
  setNotice: (notice: Notice | null) => void;
};

export function useDeleteAccount(input: DeleteAccountInput) {
  /** Google and passwordless accounts prove identity through their provider. */
  async function reauthenticate() {
    input.setBusy("reauthenticate");
    input.setNotice(null);
    try {
      const redirectUrl = await startDeletionReauthentication();
      if (redirectUrl) return window.location.assign(redirectUrl);
      input.setNotice({
        tone: "success",
        message: "Check your email for a confirmation link, then come back here to delete.",
      });
    } catch (error) {
      input.setNotice(deleteAccountErrorNotice(error));
    } finally {
      input.setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!input.profile || input.deletePhrase !== "DELETE") return;
    if (!confirmAccountDeletion()) return;
    input.setBusy("delete");
    input.setNotice(null);
    try {
      await deleteAccountRequest(input.profile, input.deletePassword);
      // A public page, because the session no longer exists — anything
      // authenticated would bounce to a login screen for a deleted account.
      // It also explains that file cleanup finishes in the background.
      window.location.assign("/account-deleted");
    } catch (error) {
      input.setNotice(deleteAccountErrorNotice(error));
      input.setDeletePassword("");
      input.setBusy(null);
    }
  }

  return { deleteAccount, reauthenticate };
}

async function exportAccountData(): Promise<void> {
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
}

function useExportData(
  setBusy: (value: string | null) => void,
  setNotice: (notice: Notice | null) => void,
) {
  return async function exportData() {
    setBusy("export");
    setNotice(null);
    try {
      await exportAccountData();
      setNotice({ tone: "success", message: "Your private data export was downloaded." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your export could not be prepared.",
      });
    } finally {
      setBusy(null);
    }
  };
}

export function useDataOwnership(
  profile: Profile | null,
  setBusy: (value: string | null) => void,
  setNotice: (notice: Notice | null) => void,
) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const exportData = useExportData(setBusy, setNotice);
  const deletion = useDeleteAccount({
    profile,
    deletePhrase,
    deletePassword,
    setDeletePassword,
    setBusy,
    setNotice,
  });

  return {
    deleteOpen,
    setDeleteOpen,
    deletePhrase,
    setDeletePhrase,
    deletePassword,
    setDeletePassword,
    exportData,
    ...deletion,
  };
}

/**
 * Password change / first-password state.
 *
 * Every password field is cleared on both success and failure. Leaving a
 * rejected password in the input would keep the secret in the DOM, and would
 * invite the user to resubmit the value that was just refused.
 */
export function usePasswordPanel(hasPassword: boolean, onChanged: (message: string) => void) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function clear() {
    setCurrent("");
    setNext("");
    setConfirmation("");
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await requestJson(hasPassword ? "/api/auth/change-password" : "/api/auth/add-password", {
        method: "POST",
        body: JSON.stringify({
          ...(hasPassword ? { currentPassword: current } : {}),
          password: next,
          passwordConfirmation: confirmation,
        }),
      });
      clear();
      onChanged(
        hasPassword
          ? "Your password was changed and your other devices were signed out."
          : "A password was added. You can now sign in with your email address too.",
      );
    } catch (cause) {
      clear();
      setError(cause instanceof Error ? cause.message : "The password could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return {
    current,
    setCurrent,
    next,
    setNext,
    confirmation,
    setConfirmation,
    error,
    pending,
    submit,
  };
}

function useToggleModeledPreview(
  modeledPreviewConsent: boolean,
  setModeledPreviewConsent: (value: boolean) => void,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
  setNotice: (notice: Notice | null) => void,
  setBusy: (value: boolean) => void,
) {
  return async function toggleModeledPreviewConsent() {
    const next = !modeledPreviewConsent;
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestJson<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ modeled_preview_consent: next }),
      });
      setModeledPreviewConsent(result.modeled_preview_consent ?? next);
      setProfile((current) => (current ? { ...current, ...result } : current));
      setNotice({ tone: "success", message: "Your settings were saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your settings could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  };
}

export function usePrivacySection(
  modeledPreviewConsent: boolean,
  setModeledPreviewConsent: (value: boolean) => void,
  setIdentityReferencePath: (value: string | null) => void,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
  setNotice: (notice: Notice | null) => void,
) {
  const [previewConsentBusy, setPreviewConsentBusy] = useState(false);
  const toggleModeledPreviewConsent = useToggleModeledPreview(
    modeledPreviewConsent,
    setModeledPreviewConsent,
    setProfile,
    setNotice,
    setPreviewConsentBusy,
  );

  async function uploadIdentityReference(file: File) {
    setPreviewConsentBusy(true);
    setNotice(null);
    try {
      const result = await uploadIdentityReferenceFile(file);
      setIdentityReferencePath(result.identity_reference_path ?? null);
      setProfile((current) => (current ? { ...current, ...result } : current));
      setNotice({ tone: "success", message: "Identity reference photo saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The reference photo could not be saved.",
      });
    } finally {
      setPreviewConsentBusy(false);
    }
  }

  return { previewConsentBusy, uploadIdentityReference, toggleModeledPreviewConsent };
}

export function useSaveProfile(
  profileForm: ProfileFormState,
  save: (key: string, path: string, body: Record<string, unknown>) => Promise<Profile | unknown>,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
) {
  return async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save("profile", "/api/profile", {
      first_name: profileForm.firstName.trim() || null,
      display_name: profileForm.displayName.trim() || null,
      locale: profileForm.locale,
    });
    if (result)
      setProfile((current) => (current ? { ...current, ...(result as Profile) } : current));
  };
}

/**
 * Mutations for the security area that are not owned by a panel of their own.
 *
 * Linking Google goes through our own POST route rather than a client-side
 * provider call, so it inherits the origin check and the server-side feature
 * flag; the browser only follows the URL Supabase hands back.
 */
export function useSecurityActions(reload: () => Promise<void>, setNotice: (n: Notice) => void) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      await reload();
      setNotice({ tone: "success", message: success });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "That change could not be applied.",
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    unlinkIdentity: (identityId: string) =>
      run(async () => {
        if (!window.confirm("Remove this sign-in method from your account?")) return;
        await requestJson("/api/auth/identities/unlink", {
          method: "POST",
          body: JSON.stringify({ identityId }),
        });
      }, "That sign-in method was removed."),

    removeFactor: (factorId: string) =>
      run(async () => {
        if (!window.confirm("Turn off two-factor authentication for this account?")) return;
        await requestJson("/api/auth/mfa/unenroll", {
          method: "POST",
          body: JSON.stringify({ factorId }),
        });
      }, "Two-factor authentication is off."),

    refresh: (message: string) => run(async () => undefined, message),
  };
}

export function useSettingsFormState() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: "",
    displayName: "",
    locale: "en-US",
  });
  const [locationForm, setLocationForm] = useState<LocationFormState>({
    homeLocation: "",
    timezone: "America/Chicago",
    temperatureUnit: "fahrenheit",
  });
  const [styleForm, setStyleForm] = useState<StyleFormState>(hydrateStyleForm(null));
  const [modeledPreviewConsent, setModeledPreviewConsent] = useState(false);
  const [identityReferencePath, setIdentityReferencePath] = useState<string | null>(null);

  return {
    profile,
    setProfile,
    profileForm,
    setProfileForm,
    locationForm,
    setLocationForm,
    styleForm,
    setStyleForm,
    modeledPreviewConsent,
    setModeledPreviewConsent,
    identityReferencePath,
    setIdentityReferencePath,
  };
}

async function fetchSettings(signal: AbortSignal) {
  const [profile, style] = await Promise.all([
    requestJson<Profile>("/api/profile", { signal }),
    requestJson<StyleProfile | null>("/api/style-profile", { signal }),
  ]);
  return { profile, style };
}

export function useSettingsLoad(
  configured: boolean,
  retry: number,
  setNotice: (notice: Notice | null) => void,
) {
  const state = useSettingsFormState();
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setNotice(null);
      fetchSettings(controller.signal)
        .then(({ profile: nextProfile, style: nextStyle }) => {
          state.setProfile(nextProfile);
          state.setProfileForm(hydrateProfileForm(nextProfile));
          state.setLocationForm(hydrateLocationForm(nextProfile));
          state.setStyleForm(hydrateStyleForm(nextStyle));
          state.setModeledPreviewConsent(nextProfile.modeled_preview_consent ?? false);
          state.setIdentityReferencePath(nextProfile.identity_reference_path ?? null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, retry]);

  return { ...state, loading };
}

export function useSettingsSave() {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  return { busy, setBusy, notice, setNotice, save };
}

function buildStylePayload(form: StyleFormState) {
  return {
    style_keywords: form.styles,
    common_activities: form.activities,
    favorite_colors: commaSeparated(form.favoriteColors),
    avoided_colors: commaSeparated(form.avoidedColors),
    preferred_fits: commaSeparated(form.preferredFits),
    preferred_formality: form.formality ? Number(form.formality) : null,
    runs_cold: form.temperatureComfort === "cold" ? true : null,
    runs_hot: form.temperatureComfort === "hot" ? true : null,
    size_profile: {
      ...(form.topSize.trim() ? { top: form.topSize.trim() } : {}),
      ...(form.bottomSize.trim() ? { bottom: form.bottomSize.trim() } : {}),
      ...(form.dressSize.trim() ? { dress: form.dressSize.trim() } : {}),
      ...(form.shoeSize.trim() ? { shoes: form.shoeSize.trim() } : {}),
    },
    modesty_preferences: form.coverageNotes.trim() ? { notes: form.coverageNotes.trim() } : {},
    notes: form.styleNote.trim(),
  };
}

function useStyleToggles(
  styleForm: StyleFormState,
  setStyleForm: (updater: (current: StyleFormState) => StyleFormState) => void,
) {
  function toggleStyle(value: string) {
    toggleSelection(value, styleForm.styles, (styles) =>
      setStyleForm((current) => ({ ...current, styles })),
    );
  }

  function toggleActivity(value: string) {
    toggleSelection(value, styleForm.activities, (activities) =>
      setStyleForm((current) => ({ ...current, activities })),
    );
  }

  return { toggleStyle, toggleActivity };
}

function useSaveLocation(
  locationForm: LocationFormState,
  save: (key: string, path: string, body: Record<string, unknown>) => Promise<Profile | unknown>,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
) {
  return async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save("location", "/api/profile", {
      home_location_name: locationForm.homeLocation.trim() || null,
      timezone: locationForm.timezone,
      temperature_unit: locationForm.temperatureUnit,
    });
    if (result)
      setProfile((current) => (current ? { ...current, ...(result as Profile) } : current));
  };
}

function useSaveStyle(
  styleForm: StyleFormState,
  save: (key: string, path: string, body: Record<string, unknown>) => Promise<unknown>,
) {
  return async function saveStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save("style", "/api/style-profile", buildStylePayload(styleForm));
  };
}

export function useSettingsManagerState(configured: boolean) {
  const [retry, setRetry] = useState(0);
  const [activeSection, setActiveSection] = useState("settings-profile");
  const { busy, setBusy, notice, setNotice, save } = useSettingsSave();
  const data = useSettingsLoad(configured, retry, setNotice);

  const disabled = !configured || data.loading || busy !== null || data.profile === null;
  const saveProfile = useSaveProfile(data.profileForm, save, data.setProfile);
  const saveStyle = useSaveStyle(data.styleForm, save);
  const saveLocation = useSaveLocation(data.locationForm, save, data.setProfile);
  const toggles = useStyleToggles(data.styleForm, data.setStyleForm);
  const privacy = usePrivacySection(
    data.modeledPreviewConsent,
    data.setModeledPreviewConsent,
    data.setIdentityReferencePath,
    data.setProfile,
    setNotice,
  );
  const dataOwnership = useDataOwnership(data.profile, setBusy, setNotice);
  // Loaded once here and shared: both the security area and the deletion form
  // need to know which sign-in methods exist, and two fetches could disagree.
  const security = useAccountSecurity(configured);

  return {
    ...data,
    configured,
    security,
    retry,
    setRetry,
    activeSection,
    setActiveSection,
    busy,
    notice,
    setNotice,
    disabled,
    saveProfile,
    saveStyle,
    saveLocation,
    ...toggles,
    ...privacy,
    ...dataOwnership,
  };
}
