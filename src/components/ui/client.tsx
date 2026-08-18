"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { FieldShell } from "./";
import { useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./";
import Script from "next/script";
import { useRef } from "react";
import { clientEnv, isCaptchaConfigured } from "@/lib/env/client";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  id: string;
  /**
   * Password managers rely on this to tell "the password you have" apart from
   * "a password you are choosing", which is what makes them offer to save a
   * new one instead of autofilling the old one. Always passed explicitly.
   */
  autoComplete: "current-password" | "new-password";
};

export function PasswordField({ label, hint, id, ...props }: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const statusId = useId();

  return (
    <FieldShell hint={hint} htmlFor={id} label={label}>
      <div className="password-field">
        <input className="text-input" id={id} type={revealed ? "text" : "password"} {...props} />
        <button
          aria-controls={id}
          aria-describedby={statusId}
          className="password-field__toggle"
          onClick={() => setRevealed((current) => !current)}
          type="button"
        >
          {revealed ? (
            <EyeSlash aria-hidden="true" size={18} />
          ) : (
            <Eye aria-hidden="true" size={18} />
          )}
          <span className="sr-only">{revealed ? "Hide password" : "Show password"}</span>
        </button>
      </div>
      {/* Polite, so toggling visibility does not interrupt a screen reader
          mid-field, but the state change is still announced. */}
      <span className="sr-only" id={statusId} role="status">
        {revealed ? "Password is visible" : "Password is hidden"}
      </span>
    </FieldShell>
  );
}

/**
 * Keeps the non-secret fields a user typed across a failed submission.
 *
 * Auth forms are server POSTs that answer with a 303, so the browser discards
 * everything typed — including the email address, which the user then has to
 * retype purely because their password was wrong.
 *
 * The obvious fix, echoing the value back in the redirect query string, is
 * exactly what the email policy forbids: it would put the address into browser
 * history, server logs, and the `Referer` of anything the page loads. So the
 * values are stashed in `sessionStorage` instead, which never leaves the tab
 * and is cleared when it closes.
 *
 * `names` must contain only non-secret fields. Passwords and one-time codes
 * are deliberately never retained: a rejected secret should be retyped, not
 * resubmitted, and keeping one in storage would outlive the request.
 */
export function RetainedFields({
  formId,
  names,
  children,
}: {
  formId: string;
  names: readonly string[];
  children: ReactNode;
}) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    for (const name of names) {
      const field = form.elements.namedItem(name);
      const stored = sessionStorage.getItem(`${formId}:${name}`);
      if (field instanceof HTMLInputElement && stored && !field.value) field.value = stored;
    }

    const save = () => {
      for (const name of names) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement) {
          sessionStorage.setItem(`${formId}:${name}`, field.value);
        }
      }
    };
    form.addEventListener("submit", save);
    return () => form.removeEventListener("submit", save);
  }, [formId, names]);

  return <>{children}</>;
}

/**
 * Submit button that disables itself while the form is in flight.
 *
 * `useFormStatus` reads the state of the enclosing form, so this works for the
 * plain server-POST forms used throughout auth without any client state. That
 * matters most on the destructive and email-sending flows, where a
 * double-click would otherwise send two confirmation emails or burn two
 * rate-limit slots.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  variant = "primary",
}: {
  children: string;
  pendingLabel: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      disabled={disabled || pending}
      fullWidth
      type="submit"
      variant={variant}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when CAPTCHA is off, so a deployment without it has no dead
 * markup and no request to Cloudflare. The token it produces is submitted with
 * the form and passed on to Supabase, which holds the secret and performs the
 * actual verification — this component is a token source, never a gate. The
 * server refuses the request outright when the flag is on and no token
 * arrives, so removing this widget in the browser fails the submission rather
 * than bypassing it.
 */
export function TurnstileField({ action }: { action: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A used token is single-use, so a failed submit must leave a fresh one
    // behind or the retry is rejected for a reason the user cannot see.
    const node = container.current;
    return () => {
      if (node) node.innerHTML = "";
    };
  }, []);

  if (!isCaptchaConfigured()) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        id="cf-turnstile"
      />
      <div
        className="cf-turnstile"
        data-action={action}
        data-response-field-name="captchaToken"
        data-sitekey={clientEnv.turnstileSiteKey}
        ref={container}
      />
    </>
  );
}
