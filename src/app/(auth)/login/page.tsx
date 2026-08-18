import { AuthEmailDivider } from "@/components/ui";
import { AuthFeedback } from "@/components/ui";
import { OAuthGoogleButton } from "@/components/ui";
import { PasswordField } from "@/components/ui/client";
import { RetainedFields } from "@/components/ui/client";
import type { SearchParamValue } from "@/components/ui/auth";
import { SubmitButton } from "@/components/ui/client";
import { TextField } from "@/components/ui";
import { TurnstileField } from "@/components/ui/client";
import { safeReturnTo } from "@/lib/auth/redirects";
import { clientEnv } from "@/lib/env/client";
import { getFrontendConfig } from "@/lib/backend/server";

import Link from "next/link";
import { AuthConfigurationNote } from "@/components/ui";

function LoginFooterLinks({ configured }: { configured: boolean }) {
  return (
    <>
      {clientEnv.magicLinkEnabled ? (
        <p className="auth-card__switch">
          <Link href="/magic-link">Email me a sign-in link instead</Link>
        </p>
      ) : null}
      {/* Permanent, and shown to everyone. The sign-in error deliberately does
          not distinguish "wrong password" from "not confirmed yet", so the way
          back has to be a link anyone can follow rather than a hint that would
          confirm an address is registered. */}
      <p className="auth-card__switch">
        Waiting on a confirmation email? <Link href="/check-email">Resend it</Link>
      </p>
      <AuthConfigurationNote
        configured={configured}
        readyMessage="Sign-in is rate limited, and protected by two-factor authentication when you enable it."
      />
      <p className="auth-card__switch">
        New to Wardrobe AI? <Link href="/signup">Create an account</Link>
      </p>
    </>
  );
}

export const metadata = { title: "Log in" };

const LOGIN_RETAINED_FIELDS = ["email"] as const;

function LoginForm({ configured, returnTo }: { configured: boolean; returnTo: string }) {
  return (
    <form className="auth-form" action="/api/auth/login" id="login-form" method="post">
      {/* The email survives a wrong password; the password never does. */}
      <RetainedFields formId="login-form" names={LOGIN_RETAINED_FIELDS}>
        <input name="returnTo" type="hidden" value={returnTo} />
        <TextField
          autoComplete="email"
          id="login-email"
          label="Email address"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <div>
          <PasswordField
            autoComplete="current-password"
            id="login-password"
            label="Password"
            name="password"
            placeholder="Enter your password"
            required
          />
          <Link className="auth-form__forgot" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <TurnstileField action="login" />
        <SubmitButton disabled={!configured} pendingLabel="Signing in…">
          Log in securely
        </SubmitButton>
      </RetainedFields>
    </form>
  );
}

type LoginSearchParams = Promise<{
  error?: SearchParamValue;
  notice?: SearchParamValue;
  returnTo?: SearchParamValue;
}>;

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const query = await searchParams;
  const config = await getFrontendConfig();
  const configured = config.databaseConfigured;
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
