import { LockKey } from "@phosphor-icons/react/ssr";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { sanitizeAuthMessage } from "./auth";
import type { SearchParamValue } from "./auth";
import type { ReactNode } from "react";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import type { HTMLAttributes } from "react";
import { Info } from "@phosphor-icons/react/ssr";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { GoogleLogo } from "@phosphor-icons/react/ssr";
import { clientEnv } from "@/lib/env/client";
import type { SelectHTMLAttributes } from "react";
import type { InputHTMLAttributes } from "react";
import type { TextareaHTMLAttributes } from "react";

/**
 * States plainly whether this deployment can actually authenticate anyone.
 *
 * Demo mode exists so the pages can be reviewed without a Supabase project,
 * and the honest thing is to say so: the note never claims sign-in is ready
 * when it is not, and never names a provider that is switched off.
 */
export function AuthConfigurationNote({
  configured,
  id,
  readyMessage,
}: {
  configured: boolean;
  id?: string;
  readyMessage: string;
}) {
  return (
    <p
      className={`auth-integration-note${configured ? " auth-integration-note--ready" : ""}`}
      id={id}
      role={configured ? undefined : "status"}
    >
      <LockKey aria-hidden="true" size={14} />{" "}
      {configured
        ? readyMessage
        : "Preview mode: this deployment has no account service configured, so sign-in is unavailable."}
    </p>
  );
}

/**
 * The "or use email" rule between the provider buttons and the email form.
 *
 * Renders only when a provider button is actually above it. A separator with
 * nothing before it reads as a sign-in method the page failed to load, which
 * is the same misdirection `OAuthGoogleButton` avoids by rendering nothing at
 * all when its provider is switched off — so the two have to agree.
 */
export function AuthEmailDivider({ shown }: { shown: boolean }) {
  if (!shown) return null;

  return (
    <div className="auth-divider">
      <span>or use email</span>
    </div>
  );
}

export function AuthFeedback({
  error,
  notice,
}: {
  error?: SearchParamValue;
  notice?: SearchParamValue;
}) {
  const safeError = sanitizeAuthMessage(error);
  const safeNotice = sanitizeAuthMessage(notice);

  return (
    <>
      {safeError ? (
        <div className="auth-feedback auth-feedback--error" role="alert" aria-live="assertive">
          <WarningCircle aria-hidden="true" size={17} weight="fill" />
          <p>{safeError}</p>
        </div>
      ) : null}
      {safeNotice ? (
        <div className="auth-feedback auth-feedback--notice" role="status" aria-live="polite">
          <CheckCircle aria-hidden="true" size={17} weight="fill" />
          <p>{safeNotice}</p>
        </div>
      ) : null}
    </>
  );
}

type BadgeTone = "neutral" | "rust" | "sage" | "gold" | "outline";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function PreviewBadge() {
  return <Badge tone="outline">Preview data</Badge>;
}

export function BrandMark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      className={`brand-mark${compact ? " brand-mark--compact" : ""}`}
      href={href}
      aria-label="Wardrobe AI home"
    >
      <span className="brand-mark__monogram" aria-hidden="true">
        W
      </span>
      {compact ? null : (
        <span className="brand-mark__wordmark">
          <strong>Wardrobe</strong>
          <small>AI</small>
        </span>
      )}
    </Link>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

interface ButtonLinkProps {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
}

function buttonClass(variant: ButtonVariant, fullWidth = false, className = "") {
  return ["button", `button--${variant}`, fullWidth ? "button--full" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, fullWidth, className)} type={type} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  fullWidth = false,
  className = "",
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, fullWidth, className)} href={href}>
      {children}
    </Link>
  );
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "article" | "section" | "div";
  padded?: boolean;
}

export function Card({
  children,
  as: Element = "div",
  padded = true,
  className = "",
  ...props
}: CardProps) {
  return (
    <Element
      className={["card", padded ? "card--padded" : "", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </Element>
  );
}

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <aside className="demo-notice" aria-label="Preview content notice">
      <Info aria-hidden="true" size={17} />
      <p>{children}</p>
    </aside>
  );
}

interface FieldShellProps {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

export function FieldShell({ label, htmlFor, hint, optional, children }: FieldShellProps) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor={htmlFor}>{label}</label>
        {optional ? <span>Optional</span> : null}
      </div>
      {children}
      {hint ? <p className="form-field__hint">{hint}</p> : null}
    </div>
  );
}

export function LegalHeader() {
  return (
    <header className="legal-header">
      <BrandMark />
      <Link href="/">
        <ArrowLeft size={15} /> Back home
      </Link>
    </header>
  );
}

/**
 * "Continue with Google" — rendered only when the provider is actually
 * configured.
 *
 * A permanently disabled button captioned "Google sign-in has not been enabled
 * yet" is worse than no button: it advertises a method that does not exist.
 * When the flag is off, this renders nothing.
 *
 * It posts to our own origin rather than linking straight to the provider, so
 * the flow still gets the CSRF origin check, the server-side feature flag, and
 * `returnTo` sanitizing before the browser leaves.
 */
export function OAuthGoogleButton({
  returnTo,
  label = "Continue with Google",
}: {
  returnTo?: string;
  label?: string;
}) {
  if (!clientEnv.googleAuthEnabled) return null;

  return (
    <form action="/api/auth/oauth/google" className="oauth-form" method="post">
      <input name="intent" type="hidden" value="signin" />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <button className="oauth-button" type="submit">
        <GoogleLogo aria-hidden="true" size={19} weight="bold" /> {label}
      </button>
    </form>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="page-header__title-row">
          <h1>{title}</h1>
          {meta}
        </div>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  optional,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  optional?: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <FieldShell hint={hint} htmlFor={id} label={label} optional={optional}>
      <select className="select-input" id={id} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextField({
  label,
  hint,
  optional,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  optional?: boolean;
  id: string;
}) {
  return (
    <FieldShell hint={hint} htmlFor={id} label={label} optional={optional}>
      <input className="text-input" id={id} {...props} />
    </FieldShell>
  );
}

export function TextareaField({
  label,
  hint,
  optional,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  optional?: boolean;
  id: string;
}) {
  return (
    <FieldShell hint={hint} htmlFor={id} label={label} optional={optional}>
      <textarea className="textarea-input" id={id} {...props} />
    </FieldShell>
  );
}
