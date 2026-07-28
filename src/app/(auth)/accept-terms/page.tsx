import { ScrollIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/constants/legal";
import { safeReturnTo } from "@/lib/auth/redirects";

import { AcceptTermsForm } from "./AcceptTermsForm";

export const metadata = { title: "Review the Terms" };

type AcceptTermsSearchParams = Promise<{ error?: SearchParamValue; returnTo?: SearchParamValue }>;

/**
 * The gate for anyone without an acceptance record for the versions currently
 * in force: a Google signup, an account created directly in Supabase, or an
 * existing user after the documents were updated.
 */
export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: AcceptTermsSearchParams;
}) {
  const query = await searchParams;

  return (
    <section className="auth-card auth-card--compact" aria-labelledby="accept-terms-title">
      <span className="auth-card__icon">
        <ScrollIcon aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Before you continue</p>
        <h1 id="accept-terms-title">Review our Terms and Privacy Policy.</h1>
        <p>
          Wardrobe AI holds personal photographs, sizing, and location data, so we ask you to accept
          the current documents before using your account.
        </p>
      </div>
      <AuthFeedback error={query.error} />
      <ul className="auth-list">
        <li>
          <Link href="/terms">Terms of Service</Link> — version {TERMS_VERSION}
        </li>
        <li>
          <Link href="/privacy">Privacy Policy</Link> — version {PRIVACY_VERSION}
        </li>
      </ul>
      <AcceptTermsForm returnTo={safeReturnTo(query.returnTo)} />
    </section>
  );
}
