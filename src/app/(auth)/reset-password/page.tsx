import { Key } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { AUTH_ACTION_COOKIE } from "@/lib/auth/constants";
import { cookies } from "next/headers";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Choose a new password" };

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
