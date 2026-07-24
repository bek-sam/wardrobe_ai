import { ArrowLeft, Envelope } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AuthFeedback, type SearchParamValue } from "@/components/ui/AuthFeedback";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { isSupabaseConfigured } from "@/lib/env/client";

export const metadata = { title: "Reset password" };

type ForgotPasswordSearchParams = Promise<{
  error?: SearchParamValue;
  notice?: SearchParamValue;
}>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: ForgotPasswordSearchParams;
}) {
  const query = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <section className="auth-card auth-card--compact" aria-labelledby="reset-title">
      <span className="auth-card__icon">
        <Envelope size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Account recovery</p>
        <h1 id="reset-title">Reset your password.</h1>
        <p>Enter your email and the account service will send a secure reset link.</p>
      </div>
      <AuthFeedback error={query.error} notice={query.notice} />
      <form className="auth-form" action="/api/auth/forgot-password" method="post">
        <TextField
          autoComplete="email"
          id="reset-email"
          label="Email address"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <Button disabled={!configured} fullWidth type="submit">
          Send reset link
        </Button>
      </form>
      <p
        className={`auth-integration-note${configured ? " auth-integration-note--ready" : ""}`}
        role={configured ? undefined : "status"}
      >
        {configured
          ? "Password recovery is connected and sends a secure, time-limited email link."
          : "Preview mode: configure Supabase to enable password recovery."}
      </p>
      <Link className="auth-back" href="/login">
        <ArrowLeft size={15} /> Back to login
      </Link>
    </section>
  );
}
