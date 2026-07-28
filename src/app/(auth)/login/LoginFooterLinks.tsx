import Link from "next/link";

import { AuthConfigurationNote } from "@/components/ui/AuthConfigurationNote";
import { clientEnv } from "@/lib/env/client";

export function LoginFooterLinks({ configured }: { configured: boolean }) {
  return (
    <>
      {clientEnv.magicLinkEnabled ? (
        <p className="auth-card__switch">
          <Link href="/magic-link">Email me a sign-in link instead</Link>
        </p>
      ) : null}
      {/* Permanent, and shown to everyone. The sign-in error deliberately does
          not distinguish "wrong password" from "not confirmed yet", so the way
          back has to be a link anyone can follow rather than a hint that would
          confirm an address is registered. */}
      <p className="auth-card__switch">
        Waiting on a confirmation email? <Link href="/check-email">Resend it</Link>
      </p>
      <AuthConfigurationNote
        configured={configured}
        readyMessage="Sign-in is rate limited, and protected by two-factor authentication when you enable it."
      />
      <p className="auth-card__switch">
        New to Wardrobe AI? <Link href="/signup">Create an account</Link>
      </p>
    </>
  );
}
