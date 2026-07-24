import Link from "next/link";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import { AuthIntegrationNote } from "@/components/ui/AuthIntegrationNote";
import { OAuthGoogleButton } from "@/components/ui/OAuthGoogleButton";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { isSupabaseConfigured } from "@/lib/env/client";

import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create account" };

type SignupSearchParams = Promise<{
  error?: SearchParamValue;
  notice?: SearchParamValue;
}>;

export default async function SignupPage({ searchParams }: { searchParams: SignupSearchParams }) {
  const query = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <section className="auth-card" aria-labelledby="signup-title">
      <div className="auth-card__intro">
        <p className="eyebrow">Your private closet</p>
        <h1 id="signup-title">Start with what you own.</h1>
        <p>Create an account, then add your first piece in a few minutes.</p>
      </div>
      <OAuthGoogleButton describedBy="signup-integration-note" />
      <AuthFeedback error={query.error} notice={query.notice} />
      <div className="auth-divider">
        <span>or use email</span>
      </div>
      <SignupForm configured={configured} />
      <AuthIntegrationNote
        configured={configured}
        id="signup-integration-note"
        readyMessage="Secure email account creation is ready. Google sign-in has not been enabled yet."
        previewMessage="Preview mode: configure Supabase to enable secure account creation."
      />
      <p className="auth-card__switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
