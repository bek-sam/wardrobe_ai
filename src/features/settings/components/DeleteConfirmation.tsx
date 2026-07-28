import { Button } from "@/components/ui/Button";

import { DeleteConfirmationFields } from "./DeleteConfirmationFields";

/**
 * Final deletion confirmation.
 *
 * The copy separates what happens immediately (access ends, records are
 * removed) from what finishes afterwards (private image files are erased by a
 * background worker). Claiming everything is already gone would be untrue at
 * the moment the button is pressed.
 *
 * Accounts without a password see a reauthentication step instead of a
 * password field, because there is no password for them to re-enter.
 */
export function DeleteConfirmation({
  phrase,
  onPhrase,
  password,
  onPassword,
  hasPassword,
  busy,
  onConfirm,
  onCancel,
  onReauthenticate,
}: {
  phrase: string;
  onPhrase: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  hasPassword: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReauthenticate: () => void;
}) {
  const ready = phrase === "DELETE" && (!hasPassword || password.length > 0);

  return (
    <div className="account-delete-confirmation" role="group" aria-label="Confirm account deletion">
      <p>
        This cannot be undone. Your sign-in and records are removed straight away; your private
        image files are erased by a background job that usually finishes within minutes.
      </p>
      <DeleteConfirmationFields
        busy={busy}
        hasPassword={hasPassword}
        onPassword={onPassword}
        onPhrase={onPhrase}
        onReauthenticate={onReauthenticate}
        password={password}
        phrase={phrase}
      />
      <div className="settings-form-actions">
        <Button disabled={!ready || busy} onClick={onConfirm} variant="danger">
          {busy ? "Deleting…" : "Permanently delete account"}
        </Button>
        <Button disabled={busy} onClick={onCancel} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}
