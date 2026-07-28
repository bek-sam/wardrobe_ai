import { Badge } from "@/components/ui/Badge";
import type { AccountSecurity } from "@/features/settings/account-security.types";

import { describeSessionMethods } from "./session-methods.data";

/**
 * The account's actual email and assurance state.
 *
 * The previous Settings page rendered an empty read-only email field, which
 * left users unable to confirm which address their account even used. This
 * shows the verified address, whether it is confirmed, and any change still
 * awaiting double confirmation — the pending address is shown *alongside* the
 * current one, never in place of it, because until both mailboxes confirm the
 * old address is still the account's.
 */
export function AccountIdentityPanel({ account }: { account: AccountSecurity }) {
  return (
    <div className="security-panel">
      <h3>Account</h3>
      <dl className="security-facts">
        <div>
          <dt>Email address</dt>
          <dd>
            {account.email ?? "No email on file"}{" "}
            {account.emailConfirmed ? (
              <Badge tone="sage">Confirmed</Badge>
            ) : (
              <Badge tone="rust">Not confirmed</Badge>
            )}
          </dd>
        </div>
        {account.pendingEmail ? (
          <div>
            <dt>Pending change</dt>
            <dd>
              {account.pendingEmail} — confirm from both your current and new inbox to complete the
              change.
            </dd>
          </div>
        ) : null}
        <div>
          <dt>This session</dt>
          <dd>
            This device, signed in {account.lastSignInAt?.slice(0, 10) ?? "recently"} ·{" "}
            {describeSessionMethods(account.currentAuthenticationMethods)} ·{" "}
            {account.assuranceLevel === "aal2"
              ? "verified with two factors"
              : "verified with one factor"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
