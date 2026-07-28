import { useState } from "react";

import { requestJson } from "@/lib/api/request";

export function useMfaChallenge(factorId: string | undefined, returnTo: string) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function verify() {
    if (pending || !factorId) return;
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ factorId, code }),
      });
      // A full navigation, so the upgraded aal2 session cookie is read by the
      // proxy on the next request rather than a cached client-side route.
      window.location.assign(returnTo);
    } catch (cause) {
      // Codes rotate every 30 seconds, so a rejected one is never worth
      // resubmitting — clear it and let the user read the next one.
      setCode("");
      setError(cause instanceof Error ? cause.message : "That code did not work.");
      setPending(false);
    }
  }

  return { code, setCode, error, pending, verify };
}
