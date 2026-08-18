"use client";

import { Badge } from "@/components/ui";
import type { AccountSecurity } from "@/features/settings";
import { Button } from "@/components/ui";
import { PasswordField } from "@/components/ui/client";
import { TextField } from "@/components/ui";
import { useState } from "react";
import { requestJson } from "@/lib/api/request";
import { SelectField } from "@/components/ui";
import type { LocationFormState } from "./settings-model";
import { timezoneOptions } from "@/features/settings";
import type { MfaEnrollmentData } from "./settings-model";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { usePasswordPanel } from "./settings-model";
import Link from "next/link";
import { Card } from "@/components/ui";
import type { PrivacySectionProps } from "./settings-model";
import { useRef } from "react";
import type { ProfileFormState } from "./settings-model";
import { ShieldCheck } from "@phosphor-icons/react";
import type { Notice } from "./settings-model";
import type { useAccountSecurity } from "./settings-model";
import { useSecurityActions } from "./settings-model";
import type { StyleFormState } from "./settings-model";
import { activityOptions, styleOptions } from "@/features/settings";
import { optionValue } from "@/features/settings";
import { TextareaField } from "@/components/ui";
import type { FormEvent } from "react";
import { MapPin } from "@phosphor-icons/react";
import { User } from "@phosphor-icons/react";
import { GearSix } from "@phosphor-icons/react";
import type { DataOwnershipSectionProps } from "./settings-model";
import { DownloadSimple, Trash } from "@phosphor-icons/react";
import { DemoNotice } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { scrollTo } from "./settings-model";
import { useSettingsManagerState } from "./settings-model";
import { Bell, CoatHanger, LockKey } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";

/**
 * The account's actual email and assurance state.
 *
/**
 * Provider method names from the `amr` claim, in the words a user recognises.
 *
 * Kept as a lookup rather than shown raw: "otp" and "totp" differ by one
 * character and mean entirely different things — an emailed link versus an
 * authenticator code — which is exactly the distinction someone auditing their
 * own session needs to be able to make.
 */
const SESSION_METHOD_LABELS: Record<string, string> = {
  password: "signed in with a password",
  otp: "signed in with an email link",
  magiclink: "signed in with an email link",
  oauth: "signed in with Google",
  totp: "confirmed with an authenticator code",
  mfa: "confirmed with a second factor",
};

function describeSessionMethods(methods: readonly string[]): string {
  const labelled = methods.map((method) => SESSION_METHOD_LABELS[method]).filter(Boolean);
  return labelled.length > 0 ? labelled.join(", ") : "sign-in method unavailable";
}

/**
 * The account's actual email and assurance state.
 *
 * The previous Settings page rendered an empty read-only email field, which
 * left users unable to confirm which address their account even used. This
 * shows the verified address, whether it is confirmed, and any change still
 * awaiting double confirmation — the pending address is shown *alongside* the
 * current one, never in place of it, because until both mailboxes confirm the
 * old address is still the account's.
 */
export function AccountIdentityPanel({ account }: { account: AccountSecurity }) {
  return (
    <div className="security-panel">
      <h3>Account</h3>
      <dl className="security-facts">
        <div>
          <dt>Email address</dt>
          <dd>
            {account.email ?? "No email on file"}{" "}
            {account.emailConfirmed ? (
              <Badge tone="sage">Confirmed</Badge>
            ) : (
              <Badge tone="rust">Not confirmed</Badge>
            )}
          </dd>
        </div>
        {account.pendingEmail ? (
          <div>
            <dt>Pending change</dt>
            <dd>
              {account.pendingEmail} — confirm from both your current and new inbox to complete the
              change.
            </dd>
          </div>
        ) : null}
        <div>
          <dt>This session</dt>
          <dd>
            This device, signed in {account.lastSignInAt?.slice(0, 10) ?? "recently"} ·{" "}
            {describeSessionMethods(account.currentAuthenticationMethods)} ·{" "}
            {account.assuranceLevel === "aal2"
              ? "verified with two factors"
              : "verified with one factor"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ChoiceFieldset({
  legend,
  legendClassName,
  options,
  selected,
  onToggle,
  disabled,
  valueFor,
}: {
  legend: string;
  legendClassName?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled: boolean;
  valueFor: (option: string) => string;
}) {
  return (
    <fieldset className="choice-fieldset" disabled={disabled}>
      <legend className={legendClassName}>{legend}</legend>
      <div className="choice-grid">
        {options.map((option) => {
          const value = valueFor(option);
          return (
            <label className="choice-chip" key={option}>
              <input
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
                type="checkbox"
                value={value}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Shown instead of a password field when the account has none.
 *
 * A Google-only or passwordless account has an email address but no password,
 * so asking for one would make deletion impossible for those users — which is
 * exactly the bug this replaces. They confirm through their provider instead.
 */
function DeleteReauthenticationPrompt({
  busy,
  onReauthenticate,
}: {
  busy: boolean;
  onReauthenticate: () => void;
}) {
  return (
    <div className="form-field">
      <p className="form-field__hint">
        This account signs in without a password, so we confirm it is you through your sign-in
        provider first.
      </p>
      <Button disabled={busy} onClick={onReauthenticate} variant="secondary">
        Confirm my identity
      </Button>
    </div>
  );
}

function DeleteConfirmationFields({
  phrase,
  onPhrase,
  password,
  onPassword,
  hasPassword,
  busy,
  onReauthenticate,
}: {
  phrase: string;
  onPhrase: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  hasPassword: boolean;
  busy: boolean;
  onReauthenticate: () => void;
}) {
  return (
    <>
      <TextField
        autoComplete="off"
        disabled={busy}
        hint="Type DELETE in capitals to confirm."
        id="delete-account-confirmation"
        label="Deletion confirmation"
        onChange={(event) => onPhrase(event.target.value)}
        value={phrase}
      />
      {hasPassword ? (
        <PasswordField
          autoComplete="current-password"
          disabled={busy}
          id="delete-account-password"
          label="Current password"
          onChange={(event) => onPassword(event.target.value)}
          value={password}
        />
      ) : (
        <DeleteReauthenticationPrompt busy={busy} onReauthenticate={onReauthenticate} />
      )}
    </>
  );
}

/**
 * Final deletion confirmation.
 *
 * The copy separates what happens immediately (access ends, records are
 * removed) from what finishes afterwards (private image files are erased by a
 * background worker). Claiming everything is already gone would be untrue at
 * the moment the button is pressed.
 *
 * Accounts without a password see a reauthentication step instead of a
 * password field, because there is no password for them to re-enter.
 */
export function DeleteConfirmation({
  phrase,
  onPhrase,
  password,
  onPassword,
  hasPassword,
  busy,
  onConfirm,
  onCancel,
  onReauthenticate,
}: {
  phrase: string;
  onPhrase: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  hasPassword: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReauthenticate: () => void;
}) {
  const ready = phrase === "DELETE" && (!hasPassword || password.length > 0);

  return (
    <div className="account-delete-confirmation" role="group" aria-label="Confirm account deletion">
      <p>
        This cannot be undone. Your sign-in and records are removed straight away; your private
        image files are erased by a background job that usually finishes within minutes.
      </p>
      <DeleteConfirmationFields
        busy={busy}
        hasPassword={hasPassword}
        onPassword={onPassword}
        onPhrase={onPhrase}
        onReauthenticate={onReauthenticate}
        password={password}
        phrase={phrase}
      />
      <div className="settings-form-actions">
        <Button disabled={!ready || busy} onClick={onConfirm} variant="danger">
          {busy ? "Deleting…" : "Permanently delete account"}
        </Button>
        <Button disabled={busy} onClick={onCancel} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function useEmailChange(onRequested: (message: string) => void) {
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/auth/email-change", {
        method: "POST",
        body: JSON.stringify({ newEmail }),
      });
      setNewEmail("");
      onRequested(
        "Check both inboxes. The change completes only after your current and new addresses each confirm it.",
      );
    } catch (cause) {
      // Kept generic on purpose: a distinguishable "already in use" would
      // confirm that some other account holds that address.
      setError(cause instanceof Error ? cause.message : "That email could not be used.");
    } finally {
      setPending(false);
    }
  }

  return { newEmail, setNewEmail, error, pending, submit };
}

/**
 * Starts a double-confirmed email change. Nothing has changed when this succeeds — both the current and the new
 * mailbox must confirm first. The copy says so, because reporting plain
 * "success" here would leave users believing their address had already moved.
 */
export function EmailChangePanel({ onRequested }: { onRequested: (message: string) => void }) {
  const form = useEmailChange(onRequested);

  return (
    <div className="security-panel">
      <h3>Change email address</h3>
      {form.error ? (
        <p className="form-field__error" role="alert">
          {form.error}
        </p>
      ) : null}
      <TextField
        autoComplete="email"
        hint="We email both your current and new address. The current one keeps working until both confirm."
        id="security-new-email"
        label="New email address"
        onChange={(event) => form.setNewEmail(event.target.value)}
        placeholder="you@example.com"
        type="email"
        value={form.newEmail}
      />
      <Button
        disabled={form.pending || form.newEmail.length === 0}
        onClick={() => void form.submit()}
      >
        {form.pending ? "Sending…" : "Send confirmation emails"}
      </Button>
    </div>
  );
}

function TimezoneSelectField({
  timezone,
  onTimezone,
  disabled,
}: {
  timezone: string;
  onTimezone: (value: string) => void;
  disabled: boolean;
}) {
  const timezoneIsKnown = timezoneOptions.some((option) => option.value === timezone);
  return (
    <SelectField
      disabled={disabled}
      id="settings-timezone"
      label="Timezone"
      onChange={(event) => onTimezone(event.target.value)}
      value={timezone}
    >
      {!timezoneIsKnown ? <option value={timezone}>{timezone}</option> : null}
      {timezoneOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

export function LocationFields({
  disabled,
  form,
  setForm,
}: {
  disabled: boolean;
  form: LocationFormState;
  setForm: (updater: (current: LocationFormState) => LocationFormState) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <TextField
        disabled={disabled}
        id="settings-location"
        label="Home location"
        maxLength={200}
        onChange={(event) =>
          setForm((current) => ({ ...current, homeLocation: event.target.value }))
        }
        placeholder="City or postal code"
        value={form.homeLocation}
      />
      <TimezoneSelectField
        disabled={disabled}
        onTimezone={(value) => setForm((current) => ({ ...current, timezone: value }))}
        timezone={form.timezone}
      />
      <SelectField
        disabled={disabled}
        id="settings-temperature-unit"
        label="Temperature"
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            temperatureUnit: event.target.value as "celsius" | "fahrenheit",
          }))
        }
        value={form.temperatureUnit}
      >
        <option value="fahrenheit">Fahrenheit</option>
        <option value="celsius">Celsius</option>
      </SelectField>
    </div>
  );
}

/**
 * The provisioning material, shown once.
 *
 * Supabase returns the QR as SVG markup. It is rendered through a data URI so
 * the browser treats it as an image rather than as document markup — pasting
 * provider-supplied SVG into the DOM would be a script-execution surface.
 */
function MfaSetupKey({ enrollment }: { enrollment: MfaEnrollmentData }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- an inline data
          URI has nothing for the image optimizer to fetch or cache. */}
      <img
        alt="QR code for adding Wardrobe AI to your authenticator app"
        height={180}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qr_code)}`}
        width={180}
      />
      <p>
        Cannot scan? Enter this setup key by hand, then keep it somewhere safe — it is shown only
        now and cannot be retrieved later:
      </p>
      <code className="mfa-enrollment__secret">{enrollment.secret}</code>
    </>
  );
}

/**
 * Enrollment is not complete until a code verifies. Until then the factor
 * Supabase created is unverified and changes nothing about the account, so
 * abandoning the form is harmless.
 */
function useMfaEnrollmentVerify(factorId: string, onVerified: () => void) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function verify() {
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ factorId, code }),
      });
      onVerified();
    } catch (cause) {
      setCode("");
      setError(cause instanceof Error ? cause.message : "That code did not work.");
      setPending(false);
    }
  }

  return { code, setCode, error, pending, verify };
}

export function MfaEnrollmentVerify({
  enrollment,
  onVerified,
}: {
  enrollment: MfaEnrollmentData;
  onVerified: () => void;
}) {
  const form = useMfaEnrollmentVerify(enrollment.factor_id, onVerified);

  return (
    <div className="mfa-enrollment">
      {form.error ? (
        <p className="form-field__error" role="alert">
          {form.error}
        </p>
      ) : null}
      <MfaSetupKey enrollment={enrollment} />
      <TextField
        autoComplete="one-time-code"
        id="mfa-enroll-code"
        inputMode="numeric"
        label="Code from your app"
        maxLength={6}
        onChange={(event) => form.setCode(event.target.value)}
        pattern="[0-9]{6}"
        required
        value={form.code}
      />
      <Button disabled={form.pending || form.code.length !== 6} onClick={() => void form.verify()}>
        {form.pending ? "Verifying…" : "Verify and turn on"}
      </Button>
    </div>
  );
}

/**
 * Enrollment is only complete once a code has been verified. Until then the
 * factor Supabase created is unverified and changes nothing about the
 * account's requirements, so abandoning this form is harmless.
 */
export function MfaEnrollment({ busy, onEnrolled }: { busy: boolean; onEnrolled: () => void }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    try {
      setEnrollment(
        await requestJson<MfaEnrollmentData>("/api/auth/mfa/enroll", { method: "POST" }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enrollment could not be started.");
    } finally {
      setPending(false);
    }
  }

  if (enrollment) {
    return <MfaEnrollmentVerify enrollment={enrollment} onVerified={onEnrolled} />;
  }

  return (
    <>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={busy || pending} onClick={() => void start()} variant="secondary">
        {pending ? "Preparing…" : "Set up an authenticator app"}
      </Button>
    </>
  );
}

/**
 * Two-factor authentication.
 *
 * The warning before enrollment is not boilerplate: this application has no
 * recovery codes, so losing the authenticator means an operator-assisted
 * identity check is the only way back in. Saying that *before* someone
 * enrolls is the difference between an informed choice and a lockout.
 */
export function MfaPanel({
  account,
  busy,
  onEnrolled,
  onRemove,
}: {
  account: AccountSecurity;
  busy: boolean;
  onEnrolled: () => void;
  onRemove: (factorId: string) => void;
}) {
  return (
    <div className="security-panel">
      <h3>Two-factor authentication</h3>
      {account.mfaEnabled ? (
        <>
          <p>
            Your account requires an authenticator code. This also protects your wardrobe data
            directly — a session that has not passed the code cannot read it, even outside this app.
          </p>
          <ul className="security-list">
            {account.factors.map((factor) => (
              <li key={factor.id}>
                <div>
                  <strong>{factor.friendlyName ?? "Authenticator app"}</strong>
                  <p>Added {factor.createdAt?.slice(0, 10) ?? "recently"}</p>
                </div>
                <Button disabled={busy} onClick={() => onRemove(factor.id)} variant="danger">
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>
            Add an authenticator app for a second factor. Keep a backup of the setup key: there are
            no recovery codes, so losing the app means contacting support for an identity check.
          </p>
          <MfaEnrollment busy={busy} onEnrolled={onEnrolled} />
        </>
      )}
    </div>
  );
}

/**
 * Inputs always start empty. Rendering a password field with a real value
 * would put the secret in the DOM on every load, and would invite resubmitting
 * a value that was just rejected.
 */
export function PasswordPanelFields({
  form,
  hasPassword,
}: {
  form: ReturnType<typeof usePasswordPanel>;
  hasPassword: boolean;
}) {
  return (
    <>
      {hasPassword ? (
        <PasswordField
          autoComplete="current-password"
          id="security-current-password"
          label="Current password"
          onChange={(event) => form.setCurrent(event.target.value)}
          value={form.current}
        />
      ) : (
        <p>
          You sign in with Google only. Adding a password gives you a second way in if you ever lose
          access to that account.
        </p>
      )}
      <PasswordField
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Spaces count and nothing is trimmed.`}
        id="security-new-password"
        label="New password"
        onChange={(event) => form.setNext(event.target.value)}
        value={form.next}
      />
      <PasswordField
        autoComplete="new-password"
        id="security-new-password-confirm"
        label="Confirm new password"
        onChange={(event) => form.setConfirmation(event.target.value)}
        value={form.confirmation}
      />
    </>
  );
}

/** Change an existing password, or add a first one to a Google-only account. */
export function PasswordPanel({
  account,
  onChanged,
}: {
  account: AccountSecurity;
  onChanged: (message: string) => void;
}) {
  const form = usePasswordPanel(account.hasPassword, onChanged);

  return (
    <div className="security-panel">
      <h3>{account.hasPassword ? "Change password" : "Add a password"}</h3>
      {form.error ? (
        <p className="form-field__error" role="alert">
          {form.error}
        </p>
      ) : null}
      <PasswordPanelFields form={form} hasPassword={account.hasPassword} />
      <Button
        disabled={form.pending || form.next.length < PASSWORD_MIN_LENGTH}
        onClick={() => void form.submit()}
      >
        {form.pending ? "Saving…" : account.hasPassword ? "Change password" : "Add password"}
      </Button>
    </div>
  );
}

function IdentityUploadRow({
  hasReference,
  busy,
  disabled,
  onUpload,
}: {
  hasReference: boolean;
  busy: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  return (
    <div className="toggle-row toggle-row--identity-upload">
      <span>
        <strong>Identity reference photo</strong>
        <small>
          {hasReference
            ? "A private reference photo is on file. Upload a new one to replace it."
            : "Required before modeled preview consent can be enabled."}
        </small>
      </span>
      <Button disabled={disabled || busy} onClick={() => fileInput.current?.click()} type="button">
        {busy ? "Uploading…" : hasReference ? "Replace photo" : "Upload photo"}
      </Button>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
        ref={fileInput}
        type="file"
      />
    </div>
  );
}

function ModeledPreviewToggle({
  hasReference,
  checked,
  disabled,
  onToggle,
}: {
  hasReference: boolean;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="toggle-row toggle-row--modeled-preview">
      <span>
        <strong>Modeled preview consent</strong>
        <small>
          {hasReference
            ? "Private modeled previews use your uploaded reference photo. Generated images are clearly labeled and never an accurate fit simulation."
            : "Upload a private reference photo to enable modeled previews of curated outfits."}
        </small>
      </span>
      <input
        checked={checked}
        disabled={disabled || !hasReference}
        onChange={onToggle}
        role="switch"
        type="checkbox"
      />
    </div>
  );
}

const STATIC_TOGGLES: Array<[string, string]> = [
  ["Allow product research", "Research runs only when requested and always shows sources."],
  ["Preference learning", "Editable learned-preference controls are planned for a later release."],
];

function PrivacyStaticToggles() {
  return (
    <>
      {STATIC_TOGGLES.map(([label, description]) => (
        <label className="toggle-row" key={label}>
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
          <input disabled role="switch" type="checkbox" />
        </label>
      ))}
    </>
  );
}

export function PrivacySection({
  identityReferencePath,
  modeledPreviewConsent,
  previewConsentBusy,
  disabled,
  onToggleConsent,
  onUpload,
}: PrivacySectionProps) {
  return (
    <Card as="section" className="settings-section" id="settings-privacy">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">AI & privacy</p>
          <h2>Your controls</h2>
          <p>Sensitive or expensive capabilities are always opt-in.</p>
        </div>
        <Badge tone="outline">Partially stored</Badge>
      </div>
      <div className="toggle-list">
        <PrivacyStaticToggles />
        <ModeledPreviewToggle
          checked={modeledPreviewConsent}
          disabled={disabled || previewConsentBusy}
          hasReference={Boolean(identityReferencePath)}
          onToggle={onToggleConsent}
        />
        <IdentityUploadRow
          busy={previewConsentBusy}
          disabled={disabled}
          hasReference={Boolean(identityReferencePath)}
          onUpload={onUpload}
        />
      </div>
      <div className="settings-form-actions">
        <Link href="/privacy">Read the privacy policy</Link>
      </div>
    </Card>
  );
}

function LocaleSelectField({
  locale,
  onLocale,
  disabled,
}: {
  locale: string;
  onLocale: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <SelectField
      disabled={disabled}
      id="settings-locale"
      label="Language"
      onChange={(event) => onLocale(event.target.value)}
      value={locale}
    >
      {!["en-US", "en-GB"].includes(locale) ? <option value={locale}>{locale}</option> : null}
      <option value="en-US">English (US)</option>
      <option value="en-GB">English (UK)</option>
    </SelectField>
  );
}

export function ProfileFields({
  disabled,
  form,
  setForm,
}: {
  disabled: boolean;
  form: ProfileFormState;
  setForm: (updater: (current: ProfileFormState) => ProfileFormState) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <TextField
        disabled={disabled}
        id="settings-first-name"
        label="First name"
        maxLength={100}
        onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
        placeholder="Your first name"
        value={form.firstName}
      />
      <TextField
        disabled={disabled}
        id="settings-display-name"
        label="Display name"
        maxLength={160}
        onChange={(event) =>
          setForm((current) => ({ ...current, displayName: event.target.value }))
        }
        optional
        placeholder="How your name appears"
        value={form.displayName}
      />
      <TextField
        id="settings-email"
        label="Email address"
        placeholder="Managed by your secure sign-in"
        readOnly
        type="email"
      />
      <LocaleSelectField
        disabled={disabled}
        locale={form.locale}
        onLocale={(value) => setForm((current) => ({ ...current, locale: value }))}
      />
    </div>
  );
}

/**
 * Every way this account can sign in, and whether it can be removed.
 *
 * The unlink button is hidden — not merely disabled — for the last remaining
 * method, so the interface never offers an action that would lock the user out
 * of their own account. The server enforces the same rule; this just avoids
 * presenting a dead end.
 */
export function SignInMethodsPanel({
  account,
  busy,
  onUnlink,
  onLinkGoogle,
}: {
  account: AccountSecurity;
  busy: boolean;
  onUnlink: (identityId: string) => void;
  onLinkGoogle: () => void;
}) {
  const hasGoogle = account.identities.some((identity) => identity.provider === "google");

  return (
    <div className="security-panel">
      <h3>Sign-in methods</h3>
      <ul className="security-list">
        {account.identities.map((identity) => (
          <li key={identity.identityId}>
            <div>
              <strong>{identity.label}</strong>
              <p>Linked {identity.createdAt?.slice(0, 10) ?? "recently"}</p>
            </div>
            {account.identities.length > 1 ? (
              <Button disabled={busy} onClick={() => onUnlink(identity.identityId)} variant="ghost">
                Remove
              </Button>
            ) : (
              <span className="security-list__note">Only sign-in method</span>
            )}
          </li>
        ))}
      </ul>
      {account.googleAuthEnabled && !hasGoogle ? (
        <Button disabled={busy} onClick={onLinkGoogle} variant="secondary">
          Link a Google account
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The three sign-out scopes, each labelled by what it actually does.
 *
 * "Sign out" alone is ambiguous once an account can be signed in on several
 * devices, so each control names its reach. "Everywhere" asks for confirmation
 * because it ends the current session too — the user will have to sign back in
 * on the device they are holding.
 *
 * Plain forms, so these keep working if the client bundle fails to load. That
 * matters here more than elsewhere: signing out is what someone does when they
 * think something is wrong.
 */
function SessionControlsPanel() {
  return (
    <div className="security-panel">
      <h3>Sessions</h3>
      <p>
        Signing out revokes the ability to refresh a session. Access already granted elsewhere can
        remain usable for up to an hour until it expires.
      </p>
      <div className="security-actions">
        <form action="/api/auth/logout" method="post">
          <input name="scope" type="hidden" value="local" />
          <Button type="submit" variant="secondary">
            Sign out this device
          </Button>
        </form>
        <form action="/api/auth/logout" method="post">
          <input name="scope" type="hidden" value="others" />
          <Button type="submit" variant="secondary">
            Sign out other devices
          </Button>
        </form>
        <form
          action="/api/auth/logout"
          method="post"
          onSubmit={(event) => {
            if (!window.confirm("Sign out everywhere, including this device?")) {
              event.preventDefault();
            }
          }}
        >
          <input name="scope" type="hidden" value="global" />
          <Button type="submit" variant="danger">
            Sign out everywhere
          </Button>
        </form>
      </div>
    </div>
  );
}

export function SecurityPanels({
  account,
  actions,
}: {
  account: AccountSecurity;
  actions: ReturnType<typeof useSecurityActions>;
}) {
  return (
    <>
      <AccountIdentityPanel account={account} />
      <SignInMethodsPanel
        account={account}
        busy={actions.busy}
        onLinkGoogle={() => document.forms.namedItem("link-google")?.submit()}
        onUnlink={(identityId) => void actions.unlinkIdentity(identityId)}
      />
      {/* Posted to our own origin, so linking inherits the CSRF check and the
          server-side provider flag; only the URL Supabase returns is followed. */}
      <form action="/api/auth/oauth/google" hidden method="post" name="link-google">
        <input name="intent" type="hidden" value="link" />
      </form>
      <PasswordPanel account={account} onChanged={(message) => void actions.refresh(message)} />
      <EmailChangePanel onRequested={(message) => void actions.refresh(message)} />
      <MfaPanel
        account={account}
        busy={actions.busy}
        onEnrolled={() => void actions.refresh("Two-factor authentication is on.")}
        onRemove={(factorId) => void actions.removeFactor(factorId)}
      />
      <SessionControlsPanel />
    </>
  );
}

export function SecuritySection({
  security,
  setNotice,
}: {
  security: ReturnType<typeof useAccountSecurity>;
  setNotice: (notice: Notice) => void;
}) {
  const { account, loading, error, reload } = security;
  const actions = useSecurityActions(reload, setNotice);

  return (
    <Card as="section" className="settings-section" id="settings-security">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Security &amp; sign-in</p>
          <h2>How you get in</h2>
          <p>Manage your password, sign-in methods, two-factor authentication, and sessions.</p>
        </div>
        <ShieldCheck size={22} />
      </div>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading || !account ? (
        <p role="status">Loading your security settings…</p>
      ) : (
        <SecurityPanels account={account} actions={actions} />
      )}
    </Card>
  );
}

function ColorFitFields({
  disabled,
  favoriteColors,
  onFavoriteColors,
  avoidedColors,
  onAvoidedColors,
  preferredFits,
  onPreferredFits,
}: {
  disabled: boolean;
  favoriteColors: string;
  onFavoriteColors: (value: string) => void;
  avoidedColors: string;
  onAvoidedColors: (value: string) => void;
  preferredFits: string;
  onPreferredFits: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <TextField
        disabled={disabled}
        id="settings-favorite-colors"
        label="Favorite colors"
        onChange={(event) => onFavoriteColors(event.target.value)}
        optional
        placeholder="navy, cream, rust"
        value={favoriteColors}
      />
      <TextField
        disabled={disabled}
        id="settings-avoided-colors"
        label="Colors to avoid"
        onChange={(event) => onAvoidedColors(event.target.value)}
        optional
        placeholder="neon yellow, bright orange"
        value={avoidedColors}
      />
      <TextField
        disabled={disabled}
        hint="Comma-separated; for example relaxed, straight, oversized."
        id="settings-preferred-fits"
        label="Preferred fits"
        onChange={(event) => onPreferredFits(event.target.value)}
        optional
        value={preferredFits}
      />
    </div>
  );
}

function FormalityTemperatureFields({
  disabled,
  formality,
  onFormality,
  temperatureComfort,
  onTemperatureComfort,
}: {
  disabled: boolean;
  formality: string;
  onFormality: (value: string) => void;
  temperatureComfort: string;
  onTemperatureComfort: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <SelectField
        disabled={disabled}
        id="settings-formality"
        label="Typical formality"
        onChange={(event) => onFormality(event.target.value)}
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
        onChange={(event) => onTemperatureComfort(event.target.value)}
        value={temperatureComfort}
      >
        <option value="cold">I run cold</option>
        <option value="neutral">Neutral</option>
        <option value="hot">I run hot</option>
      </SelectField>
    </div>
  );
}

function StyleActivityFieldsets({
  disabled,
  styles,
  activities,
  onToggleStyle,
  onToggleActivity,
}: {
  disabled: boolean;
  styles: string[];
  activities: string[];
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
}) {
  return (
    <>
      <ChoiceFieldset
        disabled={disabled}
        legend="Style words"
        onToggle={onToggleStyle}
        options={styleOptions}
        selected={styles}
        valueFor={optionValue}
      />
      <ChoiceFieldset
        disabled={disabled}
        legend="Common activities"
        onToggle={onToggleActivity}
        options={activityOptions}
        selected={activities}
        valueFor={(option) => option.toLowerCase()}
      />
    </>
  );
}

export function StylePreferenceFields({
  disabled,
  form,
  set,
  onToggleStyle,
  onToggleActivity,
}: {
  disabled: boolean;
  form: StyleFormState;
  set: <Key extends keyof StyleFormState>(key: Key, value: StyleFormState[Key]) => void;
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
}) {
  return (
    <>
      <StyleActivityFieldsets
        activities={form.activities}
        disabled={disabled}
        onToggleActivity={onToggleActivity}
        onToggleStyle={onToggleStyle}
        styles={form.styles}
      />
      <FormalityTemperatureFields
        disabled={disabled}
        formality={form.formality}
        onFormality={(value) => set("formality", value)}
        onTemperatureComfort={(value) => set("temperatureComfort", value)}
        temperatureComfort={form.temperatureComfort}
      />
      <ColorFitFields
        avoidedColors={form.avoidedColors}
        disabled={disabled}
        favoriteColors={form.favoriteColors}
        onAvoidedColors={(value) => set("avoidedColors", value)}
        onFavoriteColors={(value) => set("favoriteColors", value)}
        onPreferredFits={(value) => set("preferredFits", value)}
        preferredFits={form.preferredFits}
      />
    </>
  );
}

function StyleNotesFields({
  disabled,
  coverageNotes,
  onCoverageNotes,
  styleNote,
  onStyleNote,
}: {
  disabled: boolean;
  coverageNotes: string;
  onCoverageNotes: (value: string) => void;
  styleNote: string;
  onStyleNote: (value: string) => void;
}) {
  return (
    <>
      <TextareaField
        disabled={disabled}
        id="settings-coverage-notes"
        label="Coverage or modesty preferences"
        maxLength={1_000}
        onChange={(event) => onCoverageNotes(event.target.value)}
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
        onChange={(event) => onStyleNote(event.target.value)}
        optional
        placeholder="Coverage, sensory comfort, workplace dress code, or other preferences…"
        rows={4}
        value={styleNote}
      />
    </>
  );
}

const SIZE_FIELDS = [
  { key: "topSize", id: "settings-size-top", label: "Tops" },
  { key: "bottomSize", id: "settings-size-bottom", label: "Bottoms" },
  { key: "dressSize", id: "settings-size-dress", label: "Dresses" },
  { key: "shoeSize", id: "settings-size-shoes", label: "Shoes" },
] as const;

function SizesFieldset({
  disabled,
  sizes,
  onChange,
}: {
  disabled: boolean;
  sizes: Record<(typeof SIZE_FIELDS)[number]["key"], string>;
  onChange: (key: (typeof SIZE_FIELDS)[number]["key"], value: string) => void;
}) {
  return (
    <fieldset className="settings-fieldset" disabled={disabled}>
      <legend>Sizes</legend>
      <div className="form-grid form-grid--two">
        {SIZE_FIELDS.map((field) => (
          <TextField
            key={field.key}
            id={field.id}
            label={field.label}
            onChange={(event) => onChange(field.key, event.target.value)}
            optional
            value={sizes[field.key]}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function StyleSizesFields({
  disabled,
  form,
  setForm,
  onToggleStyle,
  onToggleActivity,
}: {
  disabled: boolean;
  form: StyleFormState;
  setForm: (updater: (current: StyleFormState) => StyleFormState) => void;
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
}) {
  function set<Key extends keyof StyleFormState>(key: Key, value: StyleFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <StylePreferenceFields
        disabled={disabled}
        form={form}
        onToggleActivity={onToggleActivity}
        onToggleStyle={onToggleStyle}
        set={set}
      />
      <SizesFieldset
        disabled={disabled}
        onChange={(key, value) => set(key, value)}
        sizes={{
          topSize: form.topSize,
          bottomSize: form.bottomSize,
          dressSize: form.dressSize,
          shoeSize: form.shoeSize,
        }}
      />
      <StyleNotesFields
        coverageNotes={form.coverageNotes}
        disabled={disabled}
        onCoverageNotes={(value) => set("coverageNotes", value)}
        onStyleNote={(value) => set("styleNote", value)}
        styleNote={form.styleNote}
      />
    </>
  );
}

export function StyleSizesSection({
  disabled,
  busy,
  form,
  setForm,
  onToggleStyle,
  onToggleActivity,
  onSubmit,
}: {
  disabled: boolean;
  busy: string | null;
  form: StyleFormState;
  setForm: (updater: (current: StyleFormState) => StyleFormState) => void;
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card as="section" className="settings-section" id="settings-style">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Style profile</p>
          <h2>How you like to dress</h2>
          <p>Explicit preferences take priority over inferred patterns.</p>
        </div>
        <Badge tone="outline">Optional</Badge>
      </div>
      <form onSubmit={onSubmit}>
        <StyleSizesFields
          disabled={disabled}
          form={form}
          onToggleActivity={onToggleActivity}
          onToggleStyle={onToggleStyle}
          setForm={setForm}
        />
        <div className="settings-form-actions">
          <Button disabled={disabled} type="submit">
            {busy === "style" ? "Saving…" : "Save style profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileSection({
  disabled,
  busy,
  form,
  setForm,
  onSubmit,
}: {
  disabled: boolean;
  busy: string | null;
  form: ProfileFormState;
  setForm: (updater: (current: ProfileFormState) => ProfileFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
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
      <form onSubmit={onSubmit}>
        <ProfileFields disabled={disabled} form={form} setForm={setForm} />
        <div className="settings-form-actions">
          <Button disabled={disabled} type="submit">
            {busy === "profile" ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function LocationSection({
  disabled,
  busy,
  form,
  setForm,
  onSubmit,
}: {
  disabled: boolean;
  busy: string | null;
  form: LocationFormState;
  setForm: (updater: (current: LocationFormState) => LocationFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card as="section" className="settings-section" id="settings-location">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Weather context</p>
          <h2>Location & units</h2>
          <p>Used only to retrieve weather for the dates and places you request.</p>
        </div>
        <MapPin size={22} />
      </div>
      <form onSubmit={onSubmit}>
        <LocationFields disabled={disabled} form={form} setForm={setForm} />
        <div className="settings-form-actions">
          <Button disabled={disabled} type="submit">
            {busy === "location" ? "Saving…" : "Save location settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SettingsFormSections({
  state,
}: {
  state: ReturnType<typeof useSettingsManagerState>;
}) {
  return (
    <>
      <ProfileSection
        busy={state.busy}
        disabled={state.disabled}
        form={state.profileForm}
        onSubmit={state.saveProfile}
        setForm={state.setProfileForm}
      />
      <StyleSizesSection
        busy={state.busy}
        disabled={state.disabled}
        form={state.styleForm}
        onSubmit={state.saveStyle}
        onToggleActivity={state.toggleActivity}
        onToggleStyle={state.toggleStyle}
        setForm={state.setStyleForm}
      />
      <LocationSection
        busy={state.busy}
        disabled={state.disabled}
        form={state.locationForm}
        onSubmit={state.saveLocation}
        setForm={state.setLocationForm}
      />
    </>
  );
}

function DataOwnershipActions({
  disabled,
  busy,
  onExport,
  onDelete,
}: {
  disabled: boolean;
  busy: string | null;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="data-action">
        <span>
          <DownloadSimple size={20} />
        </span>
        <div>
          <strong>Export your data</strong>
          <p>Download wardrobe metadata, preferences, outfits, plans, and image references.</p>
        </div>
        <Button disabled={disabled} onClick={onExport} variant="secondary">
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
        <Button disabled={disabled} onClick={onDelete} variant="danger">
          Delete account
        </Button>
      </div>
    </>
  );
}

function DataOwnershipSection(props: DataOwnershipSectionProps) {
  const { disabled, busy, onExport, deleteOpen, onOpenDelete } = props;

  return (
    <Card as="section" className="settings-section settings-section--data">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Data ownership</p>
          <h2>Export or delete</h2>
          <p>Download your data or permanently remove this account.</p>
        </div>
        <GearSix size={22} />
      </div>
      <DataOwnershipActions
        busy={busy}
        disabled={disabled}
        onDelete={onOpenDelete}
        onExport={onExport}
      />
      {deleteOpen ? (
        <DeleteConfirmation
          busy={busy === "delete"}
          hasPassword={props.hasPassword}
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
          onPassword={props.onDeletePassword}
          onPhrase={props.onDeletePhrase}
          onReauthenticate={props.onReauthenticate}
          password={props.deletePassword}
          phrase={props.deletePhrase}
        />
      ) : null}
    </Card>
  );
}

export function SettingsPrivacySections({
  state,
}: {
  state: ReturnType<typeof useSettingsManagerState>;
}) {
  return (
    <>
      <SecuritySection security={state.security} setNotice={state.setNotice} />
      <PrivacySection
        disabled={state.disabled}
        identityReferencePath={state.identityReferencePath}
        modeledPreviewConsent={state.modeledPreviewConsent}
        onToggleConsent={() => void state.toggleModeledPreviewConsent()}
        onUpload={(file) => void state.uploadIdentityReference(file)}
        previewConsentBusy={state.previewConsentBusy}
      />
      <DataOwnershipSection
        busy={state.busy}
        deleteOpen={state.deleteOpen}
        deletePassword={state.deletePassword}
        deletePhrase={state.deletePhrase}
        disabled={state.disabled}
        // Defaults to true while the account is still loading, so the form
        // never offers a passwordless deletion path it has not confirmed.
        hasPassword={state.security.account?.hasPassword ?? true}
        onCancelDelete={() => {
          state.setDeleteOpen(false);
          state.setDeletePhrase("");
          state.setDeletePassword("");
        }}
        onConfirmDelete={() => void state.deleteAccount()}
        onDeletePassword={state.setDeletePassword}
        onDeletePhrase={state.setDeletePhrase}
        onExport={() => void state.exportData()}
        onOpenDelete={() => state.setDeleteOpen(true)}
        onReauthenticate={() => void state.reauthenticate()}
      />
    </>
  );
}

function SettingsContent({ state }: { state: ReturnType<typeof useSettingsManagerState> }) {
  return (
    <div className="settings-content">
      <SettingsFormSections state={state} />
      <SettingsPrivacySections state={state} />
    </div>
  );
}

function SettingsStatus({
  notice,
  loading,
  onRetry,
}: {
  notice: Notice | null;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {notice ? (
        <div
          className={`inline-feedback inline-feedback--${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "error" ? <WarningCircle size={17} /> : <CheckCircle size={17} />}
          <span>{notice.message}</span>
          {notice.tone === "error" && !loading ? (
            <Button onClick={onRetry} variant="ghost">
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
    </>
  );
}

function SettingsTabs({
  activeSection,
  onOpen,
}: {
  activeSection: string;
  onOpen: (sectionId: string) => void;
}) {
  const tab = (id: string, icon: ReactNode, label: string) => (
    <button
      className={activeSection === id ? "is-active" : ""}
      onClick={() => onOpen(id)}
      type="button"
    >
      {icon} {label}
    </button>
  );
  return (
    <nav className="settings-tabs" aria-label="Settings sections">
      {tab("settings-profile", <User size={18} />, "Profile")}
      {tab("settings-style", <CoatHanger size={18} />, "Style & sizes")}
      {tab("settings-location", <MapPin size={18} />, "Location")}
      <button disabled title="Notification preferences are not available yet" type="button">
        <Bell size={18} /> Notifications
      </button>
      {tab("settings-security", <ShieldCheck size={18} />, "Security & sign-in")}
      {tab("settings-privacy", <LockKey size={18} />, "Privacy & data")}
    </nav>
  );
}

export function SettingsManager({ configured }: { configured: boolean }) {
  const state = useSettingsManagerState(configured);

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
      <SettingsStatus
        loading={state.loading}
        notice={state.notice}
        onRetry={() => state.setRetry((value) => value + 1)}
      />
      <div className="settings-layout">
        <SettingsTabs
          activeSection={state.activeSection}
          onOpen={(sectionId) => {
            state.setActiveSection(sectionId);
            scrollTo(sectionId);
          }}
        />
        <SettingsContent state={state} />
      </div>
    </div>
  );
}
