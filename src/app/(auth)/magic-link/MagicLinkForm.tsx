import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { TurnstileField } from "@/components/ui/TurnstileField";

export function MagicLinkForm({ configured, returnTo }: { configured: boolean; returnTo: string }) {
  return (
    <form className="auth-form" action="/api/auth/magic-link" method="post">
      <input name="returnTo" type="hidden" value={returnTo} />
      <TextField
        autoComplete="email"
        id="magic-link-email"
        label="Email address"
        name="email"
        placeholder="you@example.com"
        required
        type="email"
      />
      <TurnstileField action="magic-link" />
      <SubmitButton disabled={!configured} pendingLabel="Sending the link…">
        Send sign-in link
      </SubmitButton>
    </form>
  );
}
