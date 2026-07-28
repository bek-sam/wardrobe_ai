import { PasswordField } from "@/components/ui/PasswordField";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

import type { usePasswordPanel } from "./use-password-panel";

/**
 * Inputs always start empty. Rendering a password field with a real value
 * would put the secret in the DOM on every load, and would invite resubmitting
 * a value that was just rejected.
 */
export function PasswordPanelFields({
  form,
  hasPassword,
}: {
  form: ReturnType<typeof usePasswordPanel>;
  hasPassword: boolean;
}) {
  return (
    <>
      {hasPassword ? (
        <PasswordField
          autoComplete="current-password"
          id="security-current-password"
          label="Current password"
          onChange={(event) => form.setCurrent(event.target.value)}
          value={form.current}
        />
      ) : (
        <p>
          You sign in with Google only. Adding a password gives you a second way in if you ever lose
          access to that account.
        </p>
      )}
      <PasswordField
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Spaces count and nothing is trimmed.`}
        id="security-new-password"
        label="New password"
        onChange={(event) => form.setNext(event.target.value)}
        value={form.next}
      />
      <PasswordField
        autoComplete="new-password"
        id="security-new-password-confirm"
        label="Confirm new password"
        onChange={(event) => form.setConfirmation(event.target.value)}
        value={form.confirmation}
      />
    </>
  );
}
