import Link from "next/link";

import { RetainedFields } from "@/components/ui/RetainedFields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { TurnstileField } from "@/components/ui/TurnstileField";

import { SignupPasswordFields } from "./SignupPasswordFields";

const SIGNUP_RETAINED_FIELDS = ["firstName", "email"] as const;

export function SignupForm({ enabled }: { enabled: boolean }) {
  return (
    <form className="auth-form" action="/api/auth/signup" id="signup-form" method="post">
      {/* Name and email survive a rejected password; neither password does. */}
      <RetainedFields formId="signup-form" names={SIGNUP_RETAINED_FIELDS}>
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
        <SignupPasswordFields />
        <label className="check-row">
          <input name="acceptedTerms" required type="checkbox" value="yes" />{" "}
          <span>
            I agree to the <Link href="/terms">Terms</Link> and have read the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <TurnstileField action="signup" />
        <SubmitButton disabled={!enabled} pendingLabel="Creating your account…">
          Create my wardrobe
        </SubmitButton>
      </RetainedFields>
    </form>
  );
}
