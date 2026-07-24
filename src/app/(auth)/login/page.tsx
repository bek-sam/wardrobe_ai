import { GoogleLogo, LockKey } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import {
  AuthFeedback,
  sanitizeReturnTo,
  type SearchParamValue,
} from "@/components/ui/AuthFeedback";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { isSupabaseConfigured } from "@/lib/env/client";

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
      <button
        className="oauth-button"
        type="button"
        aria-describedby="auth-integration-note"
        disabled
      >
        <GoogleLogo size={19} weight="bold" /> Continue with Google
      </button>
      <AuthFeedback error={query.error} notice={query.notice} />
      <div className="auth-divider">
        <span>or use email</span>
      </div>
      <form className="auth-form" action="/api/auth/login" method="post">
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
          <TextField
            autoComplete="current-password"
            id="login-password"
            label="Password"
            name="password"
            placeholder="Enter your password"
            required
            type="password"
          />
          <Link className="auth-form__forgot" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <Button disabled={!configured} fullWidth type="submit">
          Log in securely
        </Button>
      </form>
      <p
        className={`auth-integration-note${configured ? " auth-integration-note--ready" : ""}`}
        id="auth-integration-note"
        role={configured ? undefined : "status"}
      >
        <LockKey size={14} />{" "}
        {configured
          ? "Secure email sign-in is ready. Google sign-in has not been enabled yet."
          : "Preview mode: configure Supabase to enable secure sign-in."}
      </p>
      <p className="auth-card__switch">
        New to Wardrobe AI? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}
