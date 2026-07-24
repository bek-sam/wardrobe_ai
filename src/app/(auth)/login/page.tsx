import Link from "next/link";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import { AuthIntegrationNote } from "@/components/ui/AuthIntegrationNote";
import { OAuthGoogleButton } from "@/components/ui/OAuthGoogleButton";
import { sanitizeReturnTo } from "@/components/ui/sanitize-return-to";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { isSupabaseConfigured } from "@/lib/env/client";

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
  const returnTo = sanitizeReturnTo(query.returnTo);

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card__intro">
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">Open your wardrobe.</h1>
        <p>Sign in to continue to your private closet and saved plans.</p>
      </div>
      <OAuthGoogleButton describedBy="auth-integration-note" />
      <AuthFeedback error={query.error} notice={query.notice} />
      <div className="auth-divider">
        <span>or use email</span>
      </div>
      <LoginForm configured={configured} returnTo={returnTo} />
      <AuthIntegrationNote
        configured={configured}
        id="auth-integration-note"
        readyMessage="Secure email sign-in is ready. Google sign-in has not been enabled yet."
        previewMessage="Preview mode: configure Supabase to enable secure sign-in."
      />
      <p className="auth-card__switch">
        New to Wardrobe AI? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}
