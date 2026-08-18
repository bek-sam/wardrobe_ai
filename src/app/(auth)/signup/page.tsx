import Link from "next/link";

import { AuthConfigurationNote } from "@/components/ui";
import { AuthEmailDivider } from "@/components/ui";
import { AuthFeedback } from "@/components/ui";
import { OAuthGoogleButton } from "@/components/ui";
import type { SearchParamValue } from "@/components/ui/auth";
import { getFrontendConfig } from "@/lib/backend/server";
import { RetainedFields } from "@/components/ui/client";
import { SubmitButton } from "@/components/ui/client";
import { TextField } from "@/components/ui";
import { TurnstileField } from "@/components/ui/client";
import { PasswordField } from "@/components/ui/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

const SIGNUP_RETAINED_FIELDS = ["firstName", "email"] as const;

/**
 * The confirmation field never leaves the browser as a credential — the server
 * only compares the two values and forwards the password itself.
 */
function SignupPasswordFields() {
  return (
    <>
      <PasswordField
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short sentence works well, spaces are allowed, and no symbol or capital is required.`}
        id="signup-password"
        label="Password"
        name="password"
        placeholder="Create a password"
        required
      />
      <PasswordField
        autoComplete="new-password"
        id="signup-password-confirm"
        label="Confirm password"
        name="passwordConfirmation"
        placeholder="Re-enter your password"
        required
      />
    </>
  );
}
function SignupForm({ enabled }: { enabled: boolean }) {
  return (
    <form className="auth-form" action="/api/auth/signup" id="signup-form" method="post">
      {/* Name and email survive a rejected password; neither password does. */}
      <RetainedFields formId="signup-form" names={SIGNUP_RETAINED_FIELDS}>
        <TextField
          autoComplete="given-name"
          id="signup-name"
          label="First name"
          name="firstName"
          placeholder="How should we greet you?"
          required
        />
        <TextField
          autoComplete="email"
          id="signup-email"
          label="Email address"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <SignupPasswordFields />
        <label className="check-row">
          <input name="acceptedTerms" required type="checkbox" value="yes" />{" "}
          <span>
            I agree to the <Link href="/terms">Terms</Link> and have read the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <TurnstileField action="signup" />
        <SubmitButton disabled={!enabled} pendingLabel="Creating your account…">
          Create my wardrobe
        </SubmitButton>
      </RetainedFields>
    </form>
  );
}

export const metadata = { title: "Create account" };

type SignupSearchParams = Promise<{ error?: SearchParamValue; notice?: SearchParamValue }>;

export default async function SignupPage({ searchParams }: { searchParams: SignupSearchParams }) {
  const query = await searchParams;
  const config = await getFrontendConfig();
  const configured = config.databaseConfigured;
  // Read on the server. The route enforces this flag independently — the form
  // state is only so the page tells the truth about what will happen.
  const { publicSignupEnabled: signupEnabled, googleAuthEnabled } = config;

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
      <AuthEmailDivider shown={signupEnabled && googleAuthEnabled} />
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
