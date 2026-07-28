import Link from "next/link";

import { AuthConfigurationNote } from "@/components/ui/AuthConfigurationNote";
import { AuthFeedback } from "@/components/ui/AuthFeedback";
import { OAuthGoogleButton } from "@/components/ui/OAuthGoogleButton";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { getAuthFlags } from "@/lib/auth/flags";
import { isSupabaseConfigured } from "@/lib/env/client";

import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create account" };

type SignupSearchParams = Promise<{ error?: SearchParamValue; notice?: SearchParamValue }>;

export default async function SignupPage({ searchParams }: { searchParams: SignupSearchParams }) {
  const query = await searchParams;
  const configured = isSupabaseConfigured();
  // Read on the server. The route enforces this flag independently — the form
  // state is only so the page tells the truth about what will happen.
  const signupEnabled = getAuthFlags().publicSignupEnabled;

  return (
    <section className="auth-card" aria-labelledby="signup-title">
      <div className="auth-card__intro">
        <p className="eyebrow">Your private closet</p>
        <h1 id="signup-title">Start with what you own.</h1>
        <p>Create an account, then add your first piece in a few minutes.</p>
      </div>
      {signupEnabled ? (
        <OAuthGoogleButton returnTo="/onboarding" label="Sign up with Google" />
      ) : null}
      <AuthFeedback error={query.error} notice={query.notice} />
      {!signupEnabled ? (
        <div className="auth-feedback auth-feedback--notice" role="status">
          <p>
            Wardrobe AI is invite-only at the moment, so new accounts cannot be created here yet.
            Already have one? <Link href="/login">Log in</Link>.
          </p>
        </div>
      ) : null}
      <div className="auth-divider">
        <span>or use email</span>
      </div>
      <SignupForm enabled={configured && signupEnabled} />
      <AuthConfigurationNote
        configured={configured}
        readyMessage="We email a confirmation link before your account can be used."
      />
      <p className="auth-card__switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
