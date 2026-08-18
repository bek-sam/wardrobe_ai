import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/navigation";
import { LEGAL_ACCEPTANCE_PATH } from "@/constants/legal";
import { getFrontendSession } from "@/lib/backend/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The legal-acceptance gate lives here rather than in the proxy because it
 * needs a database read, and the proxy runs on every request including static
 * assets and API calls. This layout wraps exactly the pages that must not be
 * used without current consent, and nothing else.
 *
 * A user created directly in Supabase, one who signed up through Google, or
 * one who predates a version bump has no matching record and is sent to the
 * acceptance screen before any wardrobe data is rendered.
 */
export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  const session = await getFrontendSession();
  if (!session.legalAccepted) {
    redirect(LEGAL_ACCEPTANCE_PATH);
  }

  return <AppShell>{children}</AppShell>;
}
