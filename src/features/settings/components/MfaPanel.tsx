import { Button } from "@/components/ui/Button";
import type { AccountSecurity } from "@/features/settings/account-security.types";

import { MfaEnrollment } from "./MfaEnrollment";

/**
 * Two-factor authentication.
 *
 * The warning before enrollment is not boilerplate: this application has no
 * recovery codes, so losing the authenticator means an operator-assisted
 * identity check is the only way back in. Saying that *before* someone
 * enrolls is the difference between an informed choice and a lockout.
 */
export function MfaPanel({
  account,
  busy,
  onEnrolled,
  onRemove,
}: {
  account: AccountSecurity;
  busy: boolean;
  onEnrolled: () => void;
  onRemove: (factorId: string) => void;
}) {
  return (
    <div className="security-panel">
      <h3>Two-factor authentication</h3>
      {account.mfaEnabled ? (
        <>
          <p>
            Your account requires an authenticator code. This also protects your wardrobe data
            directly — a session that has not passed the code cannot read it, even outside this app.
          </p>
          <ul className="security-list">
            {account.factors.map((factor) => (
              <li key={factor.id}>
                <div>
                  <strong>{factor.friendlyName ?? "Authenticator app"}</strong>
                  <p>Added {factor.createdAt?.slice(0, 10) ?? "recently"}</p>
                </div>
                <Button disabled={busy} onClick={() => onRemove(factor.id)} variant="danger">
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>
            Add an authenticator app for a second factor. Keep a backup of the setup key: there are
            no recovery codes, so losing the app means contacting support for an identity check.
          </p>
          <MfaEnrollment busy={busy} onEnrolled={onEnrolled} />
        </>
      )}
    </div>
  );
}
