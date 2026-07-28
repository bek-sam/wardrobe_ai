import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

export function ResetPasswordForm() {
  return (
    <form className="auth-form" action="/api/auth/reset-password" method="post">
      <PasswordField
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Spaces are allowed and nothing is trimmed.`}
        id="reset-new-password"
        label="New password"
        name="password"
        placeholder="Choose a new password"
        required
      />
      <PasswordField
        autoComplete="new-password"
        id="reset-new-password-confirm"
        label="Confirm new password"
        name="passwordConfirmation"
        placeholder="Re-enter the new password"
        required
      />
      <SubmitButton pendingLabel="Saving your new password…">Save new password</SubmitButton>
    </form>
  );
}
