import { Button } from "@/components/ui/Button";

/**
 * Shown instead of a password field when the account has none.
 *
 * A Google-only or passwordless account has an email address but no password,
 * so asking for one would make deletion impossible for those users — which is
 * exactly the bug this replaces. They confirm through their provider instead.
 */
export function DeleteReauthenticationPrompt({
  busy,
  onReauthenticate,
}: {
  busy: boolean;
  onReauthenticate: () => void;
}) {
  return (
    <div className="form-field">
      <p className="form-field__hint">
        This account signs in without a password, so we confirm it is you through your sign-in
        provider first.
      </p>
      <Button disabled={busy} onClick={onReauthenticate} variant="secondary">
        Confirm my identity
      </Button>
    </div>
  );
}
