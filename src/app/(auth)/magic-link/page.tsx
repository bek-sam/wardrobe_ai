import { ArrowLeft, PaperPlaneTilt } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthFeedback } from "@/components/ui";
import type { SearchParamValue } from "@/components/ui/auth";
import { SubmitButton } from "@/components/ui/client";
import { TextField } from "@/components/ui";
import { TurnstileField } from "@/components/ui/client";
import { getFrontendConfig } from "@/lib/backend/server";
import { safeReturnTo } from "@/lib/auth/redirects";

export const metadata = { title: "Email sign-in link" };

function MagicLinkForm({ configured, returnTo }: { configured: boolean; returnTo: string }) {
  return (
    <form className="auth-form" action="/api/auth/magic-link" method="post">
      <input name="returnTo" type="hidden" value={returnTo} />
      <TextField
        autoComplete="email"
        id="magic-link-email"
        label="Email address"
        name="email"
        placeholder="you@example.com"
        required
        type="email"
      />
      <TurnstileField action="magic-link" />
      <SubmitButton disabled={!configured} pendingLabel="Sending the link…">
        Send sign-in link
      </SubmitButton>
    </form>
  );
}

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
  const config = await getFrontendConfig();
  if (!config.magicLinkEnabled) notFound();

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
      <MagicLinkForm
        configured={config.databaseConfigured}
        returnTo={safeReturnTo(query.returnTo)}
      />
      <Link className="auth-back" href="/login">
        <ArrowLeft aria-hidden="true" size={15} /> Back to login
      </Link>
    </section>
  );
}
