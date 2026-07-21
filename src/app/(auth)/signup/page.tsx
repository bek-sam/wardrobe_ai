import { GoogleLogo, LockKey } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AuthFeedback, type SearchParamValue } from "@/components/ui/AuthFeedback";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { isSupabaseConfigured } from "@/lib/env/client";

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
      <button
        className="oauth-button"
        type="button"
        aria-describedby="signup-integration-note"
        disabled
      >
        <GoogleLogo size={19} weight="bold" /> Continue with Google
      </button>
      <AuthFeedback error={query.error} notice={query.notice} />
      <div className="auth-divider">
        <span>or use email</span>
      </div>
      <form className="auth-form" action="/api/auth/signup" method="post">
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
        <TextField
          autoComplete="new-password"
          hint="Use at least 8 characters."
          id="signup-password"
          label="Password"
          name="password"
          placeholder="Create a password"
          required
          type="password"
        />
        <label className="check-row">
          <input name="acceptedTerms" required type="checkbox" value="yes" />{" "}
          <span>
            I agree to the <Link href="/terms">Terms</Link> and have read the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <Button disabled={!configured} fullWidth type="submit">
          Create my wardrobe
        </Button>
      </form>
      <p
        className={`auth-integration-note${configured ? " auth-integration-note--ready" : ""}`}
        id="signup-integration-note"
        role={configured ? undefined : "status"}
      >
        <LockKey size={14} />{" "}
        {configured
          ? "Secure email account creation is ready. Google sign-in has not been enabled yet."
          : "Preview mode: configure Supabase to enable secure account creation."}
      </p>
      <p className="auth-card__switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
