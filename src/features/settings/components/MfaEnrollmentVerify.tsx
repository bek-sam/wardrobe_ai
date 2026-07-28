"use client";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { MfaSetupKey } from "./MfaSetupKey";
import type { MfaEnrollmentData } from "./mfa-enrollment.types";
import { useMfaEnrollmentVerify } from "./use-mfa-enrollment-verify";

export function MfaEnrollmentVerify({
  enrollment,
  onVerified,
}: {
  enrollment: MfaEnrollmentData;
  onVerified: () => void;
}) {
  const form = useMfaEnrollmentVerify(enrollment.factor_id, onVerified);

  return (
    <div className="mfa-enrollment">
      {form.error ? (
        <p className="form-field__error" role="alert">
          {form.error}
        </p>
      ) : null}
      <MfaSetupKey enrollment={enrollment} />
      <TextField
        autoComplete="one-time-code"
        id="mfa-enroll-code"
        inputMode="numeric"
        label="Code from your app"
        maxLength={6}
        onChange={(event) => form.setCode(event.target.value)}
        pattern="[0-9]{6}"
        required
        value={form.code}
      />
      <Button disabled={form.pending || form.code.length !== 6} onClick={() => void form.verify()}>
        {form.pending ? "Verifying…" : "Verify and turn on"}
      </Button>
    </div>
  );
}
