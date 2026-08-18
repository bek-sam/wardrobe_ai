import { ScrollIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { AuthFeedback } from "@/components/ui";
import type { SearchParamValue } from "@/components/ui/auth";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/constants/legal";
import { safeReturnTo } from "@/lib/auth/redirects";
import { SubmitButton } from "@/components/ui/client";

function AcceptTermsForm({ returnTo }: { returnTo: string }) {
  return (
    <form action="/api/auth/legal/accept" className="auth-form" method="post">
      <input name="returnTo" type="hidden" value={returnTo} />
      <label className="check-row">
        <input name="acceptedTerms" required type="checkbox" value="yes" />{" "}
        <span>
          I accept the <Link href="/terms">Terms</Link> and have read the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>
      <SubmitButton pendingLabel="Saving…">Accept and continue</SubmitButton>
      <p className="form-field__hint">
        Prefer not to accept? You can{" "}
        <Link href="/settings">export or delete your account data</Link> instead.
      </p>
    </form>
  );
}

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
