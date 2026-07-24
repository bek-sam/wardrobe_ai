import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export function SignupForm({ configured }: { configured: boolean }) {
  return (
    <form className="auth-form" action="/api/auth/signup" method="post">
      <TextField
        autoComplete="given-name"
        id="signup-name"
        label="First name"
        name="firstName"
        placeholder="How should we greet you?"
        required
      />
      <TextField
        autoComplete="email"
        id="signup-email"
        label="Email address"
        name="email"
        placeholder="you@example.com"
        required
        type="email"
      />
      <TextField
        autoComplete="new-password"
        hint="Use at least 8 characters."
        id="signup-password"
        label="Password"
        name="password"
        placeholder="Create a password"
        required
        type="password"
      />
      <label className="check-row">
        <input name="acceptedTerms" required type="checkbox" value="yes" />{" "}
        <span>
          I agree to the <Link href="/terms">Terms</Link> and have read the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>
      <Button disabled={!configured} fullWidth type="submit">
        Create my wardrobe
      </Button>
    </form>
  );
}
