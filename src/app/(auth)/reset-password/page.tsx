import { Key } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthFeedback } from "@/components/ui";
import { PasswordField } from "@/components/ui/client";
import type { SearchParamValue } from "@/components/ui/auth";
import { SubmitButton } from "@/components/ui/client";
import { AUTH_ACTION_COOKIE, PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { cookies } from "next/headers";

export const metadata = { title: "Choose a new password" };

function ResetPasswordForm() {
  return (
    <form className="auth-form" action="/api/auth/reset-password" method="post">
      <PasswordField
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Spaces are allowed and nothing is trimmed.`}
        id="reset-new-password"
        label="New password"
        name="password"
        placeholder="Choose a new password"
        required
      />
      <PasswordField
        autoComplete="new-password"
        id="reset-new-password-confirm"
        label="Confirm new password"
        name="passwordConfirmation"
        placeholder="Re-enter the new password"
        required
      />
      <SubmitButton pendingLabel="Saving your new password…">Save new password</SubmitButton>
    </form>
  );
}

type ResetPasswordSearchParams = Promise<{ error?: SearchParamValue; notice?: SearchParamValue }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: ResetPasswordSearchParams;
}) {
  const query = await searchParams;
  // Presence check only, so an expired link shows a way forward instead of a
  // form that will be rejected. The cookie is signed and single-use; the POST
  // route is what actually validates it, and this page's verdict grants
  // nothing on its own.
  const store = await cookies();
  const hasChallenge = Boolean(store.get(AUTH_ACTION_COOKIE)?.value);

  return (
    <section className="auth-card auth-card--compact" aria-labelledby="reset-password-title">
      <span className="auth-card__icon">
        <Key aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Account recovery</p>
        <h1 id="reset-password-title">Choose a new password.</h1>
        <p>Setting a new password signs out every other device on your account.</p>
      </div>
      <AuthFeedback error={query.error} notice={query.notice} />
      {hasChallenge ? (
        <ResetPasswordForm />
      ) : (
        <div className="auth-feedback auth-feedback--error" role="alert">
          <p>
            This reset link has expired or was already used.{" "}
            <Link href="/forgot-password">Request a new one</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
