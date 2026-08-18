import { ShieldCheck } from "@phosphor-icons/react/ssr";

import { SubmitButton } from "@/components/ui/client";
import { safeReturnTo } from "@/lib/auth/redirects";
import type { SearchParamValue } from "@/components/ui/auth";
import { getMfaFactors } from "@/lib/backend/server";

import { MfaChallengeForm } from "./MfaChallengeForm";

export const metadata = { title: "Two-factor verification" };

function SignOutLink() {
  return (
    <form action="/api/auth/logout" className="auth-form auth-form--inline" method="post">
      <input name="scope" type="hidden" value="local" />
      <SubmitButton pendingLabel="Signing out…" variant="secondary">
        Cancel and sign out
      </SubmitButton>
      <p className="form-field__hint">
        Lost your authenticator? Signing out is safe — contact support to have the factor removed
        after an identity check. We cannot bypass it from here.
      </p>
    </form>
  );
}

type MfaVerifySearchParams = Promise<{ returnTo?: SearchParamValue }>;

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: MfaVerifySearchParams;
}) {
  const query = await searchParams;
  const factors = await getMfaFactors();

  return (
    <section className="auth-card auth-card--compact" aria-labelledby="mfa-verify-title">
      <span className="auth-card__icon">
        <ShieldCheck aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">One more step</p>
        <h1 id="mfa-verify-title">Enter your authenticator code.</h1>
        <p>Open your authenticator app and enter the current six-digit code for Wardrobe AI.</p>
      </div>
      <MfaChallengeForm factors={factors} returnTo={safeReturnTo(query.returnTo)} />
      {/* A way out that is not "give up and close the tab": someone who has
          lost their authenticator needs to be able to end the session. */}
      <SignOutLink />
    </section>
  );
}
