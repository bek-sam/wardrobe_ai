import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { TurnstileField } from "@/components/ui/TurnstileField";

export function ResendConfirmationForm({ configured }: { configured: boolean }) {
  return (
    <form className="auth-form" action="/api/auth/resend-confirmation" method="post">
      <TextField
        autoComplete="email"
        id="resend-email"
        label="Email address"
        name="email"
        placeholder="you@example.com"
        required
        type="email"
      />
      <TurnstileField action="confirmation-resend" />
      <SubmitButton disabled={!configured} pendingLabel="Sending…" variant="secondary">
        Resend confirmation link
      </SubmitButton>
    </form>
  );
}
