import { Button } from "@/components/ui/Button";

import { DeleteConfirmationFields } from "./DeleteConfirmationFields";

export function DeleteConfirmation({
  phrase,
  onPhrase,
  password,
  onPassword,
  busy,
  onConfirm,
  onCancel,
}: {
  phrase: string;
  onPhrase: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="account-delete-confirmation" role="group" aria-label="Confirm account deletion">
      <p>
        This cannot be undone. Type <strong>DELETE</strong>, confirm your password, then confirm
        once more in your browser.
      </p>
      <DeleteConfirmationFields
        busy={busy}
        onPassword={onPassword}
        onPhrase={onPhrase}
        password={password}
        phrase={phrase}
      />
      <div className="settings-form-actions">
        <Button
          disabled={phrase !== "DELETE" || !password || busy}
          onClick={onConfirm}
          variant="danger"
        >
          {busy ? "Deleting…" : "Permanently delete account"}
        </Button>
        <Button disabled={busy} onClick={onCancel} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}
