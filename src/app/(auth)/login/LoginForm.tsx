import Link from "next/link";

import { PasswordField } from "@/components/ui/PasswordField";
import { RetainedFields } from "@/components/ui/RetainedFields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { TurnstileField } from "@/components/ui/TurnstileField";

const LOGIN_RETAINED_FIELDS = ["email"] as const;

export function LoginForm({ configured, returnTo }: { configured: boolean; returnTo: string }) {
  return (
    <form className="auth-form" action="/api/auth/login" id="login-form" method="post">
      {/* The email survives a wrong password; the password never does. */}
      <RetainedFields formId="login-form" names={LOGIN_RETAINED_FIELDS}>
        <input name="returnTo" type="hidden" value={returnTo} />
        <TextField
          autoComplete="email"
          id="login-email"
          label="Email address"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <div>
          <PasswordField
            autoComplete="current-password"
            id="login-password"
            label="Password"
            name="password"
            placeholder="Enter your password"
            required
          />
          <Link className="auth-form__forgot" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <TurnstileField action="login" />
        <SubmitButton disabled={!configured} pendingLabel="Signing in…">
          Log in securely
        </SubmitButton>
      </RetainedFields>
    </form>
  );
}
