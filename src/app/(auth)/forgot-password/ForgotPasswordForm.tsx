import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { TurnstileField } from "@/components/ui/TurnstileField";

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  return (
    <form className="auth-form" action="/api/auth/forgot-password" method="post">
      <TextField
        autoComplete="email"
        id="reset-email"
        label="Email address"
        name="email"
        placeholder="you@example.com"
        required
        type="email"
      />
      <TurnstileField action="password-recovery" />
      <SubmitButton disabled={!configured} pendingLabel="Sending the link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
