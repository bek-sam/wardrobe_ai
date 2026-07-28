import { PasswordField } from "@/components/ui/PasswordField";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

/**
 * The confirmation field never leaves the browser as a credential — the server
 * only compares the two values and forwards the password itself.
 */
export function SignupPasswordFields() {
  return (
    <>
      <PasswordField
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short sentence works well, spaces are allowed, and no symbol or capital is required.`}
        id="signup-password"
        label="Password"
        name="password"
        placeholder="Create a password"
        required
      />
      <PasswordField
        autoComplete="new-password"
        id="signup-password-confirm"
        label="Confirm password"
        name="passwordConfirmation"
        placeholder="Re-enter your password"
        required
      />
    </>
  );
}
