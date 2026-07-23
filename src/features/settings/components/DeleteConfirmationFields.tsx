import { TextField } from "@/components/ui/FormField";

export function DeleteConfirmationFields({
  phrase,
  onPhrase,
  password,
  onPassword,
  busy,
}: {
  phrase: string;
  onPhrase: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  busy: boolean;
}) {
  return (
    <>
      <TextField
        autoComplete="off"
        disabled={busy}
        id="delete-account-confirmation"
        label="Deletion confirmation"
        onChange={(event) => onPhrase(event.target.value)}
        value={phrase}
      />
      <TextField
        autoComplete="current-password"
        disabled={busy}
        id="delete-account-password"
        label="Current password"
        onChange={(event) => onPassword(event.target.value)}
        type="password"
        value={password}
      />
    </>
  );
}
