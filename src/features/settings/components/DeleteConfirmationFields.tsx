import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";

import { DeleteReauthenticationPrompt } from "./DeleteReauthenticationPrompt";

export function DeleteConfirmationFields({
  phrase,
  onPhrase,
  password,
  onPassword,
  hasPassword,
  busy,
  onReauthenticate,
}: {
  phrase: string;
  onPhrase: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  hasPassword: boolean;
  busy: boolean;
  onReauthenticate: () => void;
}) {
  return (
    <>
      <TextField
        autoComplete="off"
        disabled={busy}
        hint="Type DELETE in capitals to confirm."
        id="delete-account-confirmation"
        label="Deletion confirmation"
        onChange={(event) => onPhrase(event.target.value)}
        value={phrase}
      />
      {hasPassword ? (
        <PasswordField
          autoComplete="current-password"
          disabled={busy}
          id="delete-account-password"
          label="Current password"
          onChange={(event) => onPassword(event.target.value)}
          value={password}
        />
      ) : (
        <DeleteReauthenticationPrompt busy={busy} onReauthenticate={onReauthenticate} />
      )}
    </>
  );
}
