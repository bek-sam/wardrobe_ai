import type { AccountSecurity } from "@/features/settings/account-security.types";

import { AccountIdentityPanel } from "./AccountIdentityPanel";
import { EmailChangePanel } from "./EmailChangePanel";
import { MfaPanel } from "./MfaPanel";
import { PasswordPanel } from "./PasswordPanel";
import { SessionControlsPanel } from "./SessionControlsPanel";
import { SignInMethodsPanel } from "./SignInMethodsPanel";
import type { useSecurityActions } from "./use-security-actions";

export function SecurityPanels({
  account,
  actions,
}: {
  account: AccountSecurity;
  actions: ReturnType<typeof useSecurityActions>;
}) {
  return (
    <>
      <AccountIdentityPanel account={account} />
      <SignInMethodsPanel
        account={account}
        busy={actions.busy}
        onLinkGoogle={() => document.forms.namedItem("link-google")?.submit()}
        onUnlink={(identityId) => void actions.unlinkIdentity(identityId)}
      />
      {/* Posted to our own origin, so linking inherits the CSRF check and the
          server-side provider flag; only the URL Supabase returns is followed. */}
      <form action="/api/auth/oauth/google" hidden method="post" name="link-google">
        <input name="intent" type="hidden" value="link" />
      </form>
      <PasswordPanel account={account} onChanged={(message) => void actions.refresh(message)} />
      <EmailChangePanel onRequested={(message) => void actions.refresh(message)} />
      <MfaPanel
        account={account}
        busy={actions.busy}
        onEnrolled={() => void actions.refresh("Two-factor authentication is on.")}
        onRemove={(factorId) => void actions.removeFactor(factorId)}
      />
      <SessionControlsPanel />
    </>
  );
}
