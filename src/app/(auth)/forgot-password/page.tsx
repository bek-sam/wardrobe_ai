import { ArrowLeft, Envelope } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import { AuthIntegrationNote } from "@/components/ui/AuthIntegrationNote";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { isSupabaseConfigured } from "@/lib/env/client";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

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
      <ForgotPasswordForm configured={configured} />
      <AuthIntegrationNote
        configured={configured}
        readyMessage="Password recovery is connected and sends a secure, time-limited email link."
        previewMessage="Preview mode: configure Supabase to enable password recovery."
        icon={false}
      />
      <Link className="auth-back" href="/login">
        <ArrowLeft size={15} /> Back to login
      </Link>
    </section>
  );
}
