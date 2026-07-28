import { ArrowLeft, PaperPlaneTilt } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthFeedback } from "@/components/ui/AuthFeedback";
import type { SearchParamValue } from "@/components/ui/search-param-value";
import { getAuthFlags } from "@/lib/auth/flags";
import { safeReturnTo } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/env/client";

import { MagicLinkForm } from "./MagicLinkForm";

export const metadata = { title: "Email sign-in link" };

type MagicLinkSearchParams = Promise<{
  error?: SearchParamValue;
  notice?: SearchParamValue;
  returnTo?: SearchParamValue;
}>;

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: MagicLinkSearchParams;
}) {
  // Absent, not disabled, when the feature is off — a page that exists but
  // refuses to work is an invitation to probe it.
  if (!getAuthFlags().magicLinkEnabled) notFound();

  const query = await searchParams;

  return (
    <section className="auth-card auth-card--compact" aria-labelledby="magic-link-title">
      <span className="auth-card__icon">
        <PaperPlaneTilt aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Passwordless</p>
        <h1 id="magic-link-title">Email me a sign-in link.</h1>
        <p>
          For existing accounts only — this never creates one. If you have two-factor authentication
          on, you will still be asked for your code.
        </p>
      </div>
      <AuthFeedback error={query.error} notice={query.notice} />
      <MagicLinkForm configured={isSupabaseConfigured()} returnTo={safeReturnTo(query.returnTo)} />
      <Link className="auth-back" href="/login">
        <ArrowLeft aria-hidden="true" size={15} /> Back to login
      </Link>
    </section>
  );
}
