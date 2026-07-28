import { ShieldCheck } from "@phosphor-icons/react/ssr";

import { safeReturnTo } from "@/lib/auth/redirects";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { requireLiveUser } from "@/lib/auth/live-user";

import { MfaChallengeForm } from "./MfaChallengeForm";
import { SignOutLink } from "./SignOutLink";

export const metadata = { title: "Two-factor verification" };

type MfaVerifySearchParams = Promise<{ returnTo?: SearchParamValue }>;

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: MfaVerifySearchParams;
}) {
  const query = await searchParams;
  const { supabase } = await requireLiveUser();
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = (data?.totp ?? []).map((factor) => ({
    id: factor.id,
    label: factor.friendly_name ?? "Authenticator app",
  }));

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
