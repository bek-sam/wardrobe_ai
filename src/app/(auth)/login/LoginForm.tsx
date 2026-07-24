import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export function LoginForm({ configured, returnTo }: { configured: boolean; returnTo: string }) {
  return (
    <form className="auth-form" action="/api/auth/login" method="post">
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
        <TextField
          autoComplete="current-password"
          id="login-password"
          label="Password"
          name="password"
          placeholder="Enter your password"
          required
          type="password"
        />
        <Link className="auth-form__forgot" href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      <Button disabled={!configured} fullWidth type="submit">
        Log in securely
      </Button>
    </form>
  );
}
