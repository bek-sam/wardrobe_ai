"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { requestJson } from "@/lib/api/request";

import { MfaEnrollmentVerify } from "./MfaEnrollmentVerify";
import type { MfaEnrollmentData } from "./mfa-enrollment.types";

/**
 * Enrollment is only complete once a code has been verified. Until then the
 * factor Supabase created is unverified and changes nothing about the
 * account's requirements, so abandoning this form is harmless.
 */
export function MfaEnrollment({ busy, onEnrolled }: { busy: boolean; onEnrolled: () => void }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    try {
      setEnrollment(
        await requestJson<MfaEnrollmentData>("/api/auth/mfa/enroll", { method: "POST" }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enrollment could not be started.");
    } finally {
      setPending(false);
    }
  }

  if (enrollment) {
    return <MfaEnrollmentVerify enrollment={enrollment} onVerified={onEnrolled} />;
  }

  return (
    <>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={busy || pending} onClick={() => void start()} variant="secondary">
        {pending ? "Preparing…" : "Set up an authenticator app"}
      </Button>
    </>
  );
}
