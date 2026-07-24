import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

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
      <Button disabled={!configured} fullWidth type="submit">
        Send reset link
      </Button>
    </form>
  );
}
