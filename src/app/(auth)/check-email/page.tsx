import { ArrowLeft, Envelope } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { isSupabaseConfigured } from "@/lib/env/client";

import { ResendConfirmationForm } from "./ResendConfirmationForm";

export const metadata = { title: "Check your email" };

type CheckEmailSearchParams = Promise<{ error?: SearchParamValue; notice?: SearchParamValue }>;

/**
 * The landing page for every "we sent you something" flow.
 *
 * It deliberately does not name the address the link went to. Putting the
 * email in the URL would leak it into browser history, server logs, and the
 * `Referer` header of anything the page loads.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: CheckEmailSearchParams;
}) {
  const query = await searchParams;

  return (
    <section className="auth-card auth-card--compact" aria-labelledby="check-email-title">
      <span className="auth-card__icon">
        <Envelope aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Almost there</p>
        <h1 id="check-email-title">Check your email.</h1>
        <p>
          If the address you entered has an account, a link is on its way. Links expire quickly and
          can only be used once, so request a new one if it has been sitting a while.
        </p>
      </div>
      <AuthFeedback error={query.error} notice={query.notice} />
      <details className="auth-details">
        <summary>Nothing arrived?</summary>
        <p>
          Check your spam folder first, then send a new confirmation link. We reply the same way
          whether or not the address is registered.
        </p>
        <ResendConfirmationForm configured={isSupabaseConfigured()} />
      </details>
      <Link className="auth-back" href="/login">
        <ArrowLeft aria-hidden="true" size={15} /> Back to login
      </Link>
    </section>
  );
}
