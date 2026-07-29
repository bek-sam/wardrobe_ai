import { AuthEmailDivider } from "@/components/ui/AuthEmailDivider";
import { AuthFeedback } from "@/components/ui/AuthFeedback";
import { OAuthGoogleButton } from "@/components/ui/OAuthGoogleButton";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { safeReturnTo } from "@/lib/auth/redirects";
import { clientEnv, isSupabaseConfigured } from "@/lib/env/client";

import { LoginFooterLinks } from "./LoginFooterLinks";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

type LoginSearchParams = Promise<{
  error?: SearchParamValue;
  notice?: SearchParamValue;
  returnTo?: SearchParamValue;
}>;

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const query = await searchParams;
  const configured = isSupabaseConfigured();
  const returnTo = safeReturnTo(query.returnTo);

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card__intro">
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">Open your wardrobe.</h1>
        <p>Sign in to continue to your private closet and saved plans.</p>
      </div>
      <OAuthGoogleButton returnTo={returnTo} />
      <AuthFeedback error={query.error} notice={query.notice} />
      <AuthEmailDivider shown={clientEnv.googleAuthEnabled} />
      <LoginForm configured={configured} returnTo={returnTo} />
      <LoginFooterLinks configured={configured} />
    </section>
  );
}
