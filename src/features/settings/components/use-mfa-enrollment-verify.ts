import { useState } from "react";

import { requestJson } from "@/lib/api/request";

/**
 * Enrollment is not complete until a code verifies. Until then the factor
 * Supabase created is unverified and changes nothing about the account, so
 * abandoning the form is harmless.
 */
export function useMfaEnrollmentVerify(factorId: string, onVerified: () => void) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function verify() {
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ factorId, code }),
      });
      onVerified();
    } catch (cause) {
      setCode("");
      setError(cause instanceof Error ? cause.message : "That code did not work.");
      setPending(false);
    }
  }

  return { code, setCode, error, pending, verify };
}
