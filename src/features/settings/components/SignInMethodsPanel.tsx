import { Button } from "@/components/ui/Button";
import type { AccountSecurity } from "@/features/settings/account-security.types";

/**
 * Every way this account can sign in, and whether it can be removed.
 *
 * The unlink button is hidden — not merely disabled — for the last remaining
 * method, so the interface never offers an action that would lock the user out
 * of their own account. The server enforces the same rule; this just avoids
 * presenting a dead end.
 */
export function SignInMethodsPanel({
  account,
  busy,
  onUnlink,
  onLinkGoogle,
}: {
  account: AccountSecurity;
  busy: boolean;
  onUnlink: (identityId: string) => void;
  onLinkGoogle: () => void;
}) {
  const hasGoogle = account.identities.some((identity) => identity.provider === "google");

  return (
    <div className="security-panel">
      <h3>Sign-in methods</h3>
      <ul className="security-list">
        {account.identities.map((identity) => (
          <li key={identity.identityId}>
            <div>
              <strong>{identity.label}</strong>
              <p>Linked {identity.createdAt?.slice(0, 10) ?? "recently"}</p>
            </div>
            {account.identities.length > 1 ? (
              <Button disabled={busy} onClick={() => onUnlink(identity.identityId)} variant="ghost">
                Remove
              </Button>
            ) : (
              <span className="security-list__note">Only sign-in method</span>
            )}
          </li>
        ))}
      </ul>
      {account.googleAuthEnabled && !hasGoogle ? (
        <Button disabled={busy} onClick={onLinkGoogle} variant="secondary">
          Link a Google account
        </Button>
      ) : null}
    </div>
  );
}
