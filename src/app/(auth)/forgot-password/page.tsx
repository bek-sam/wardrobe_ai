import { ArrowLeft, Envelope } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthConfigurationNote } from "@/components/ui/AuthConfigurationNote";
import { AuthFeedback } from "@/components/ui/AuthFeedback";
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
        <Envelope aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Account recovery</p>
        <h1 id="reset-title">Reset your password.</h1>
        <p>
          Enter your email and we will send a secure link. The response is the same whether or not
          an account exists, so nobody can use this page to discover who has one.
        </p>
      </div>
      <AuthFeedback error={query.error} notice={query.notice} />
      <ForgotPasswordForm configured={configured} />
      <AuthConfigurationNote
        configured={configured}
        readyMessage="The link is single-use, expires in minutes, and signs out your other sessions once the password changes."
      />
      <Link className="auth-back" href="/login">
        <ArrowLeft aria-hidden="true" size={15} /> Back to login
      </Link>
    </section>
  );
}
