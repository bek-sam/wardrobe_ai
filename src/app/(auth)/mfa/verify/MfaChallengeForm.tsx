"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui";
import { TextField } from "@/components/ui";
import { requestJson } from "@/lib/api/request";

type Factor = { id: string; label: string };

function useMfaChallenge(factorId: string | undefined, returnTo: string) {
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

export function MfaChallengeForm({ factors, returnTo }: { factors: Factor[]; returnTo: string }) {
  const challenge = useMfaChallenge(factors[0]?.id, returnTo);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void challenge.verify();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {/* Submitting before hydration falls back to a native GET to this same
          path, and the browser rebuilds the query from named fields only — so
          without this the reload drops `returnTo` and the user is sent to the
          default page after passing the challenge. The code field stays
          deliberately unnamed: a native submit must never put a one-time code
          into the URL, history, or a Referer header. */}
      <input name="returnTo" type="hidden" value={returnTo} />
      {challenge.error ? (
        <div className="auth-feedback auth-feedback--error" role="alert">
          <p>{challenge.error}</p>
        </div>
      ) : null}
      <TextField
        autoComplete="one-time-code"
        autoFocus
        id="mfa-code"
        inputMode="numeric"
        label="Six-digit code"
        maxLength={6}
        onChange={(event) => challenge.setCode(event.target.value)}
        pattern="[0-9]{6}"
        placeholder="123456"
        required
        value={challenge.code}
      />
      <Button
        aria-busy={challenge.pending}
        disabled={challenge.pending || factors.length === 0}
        fullWidth
        type="submit"
      >
        {challenge.pending ? "Verifying…" : "Verify and continue"}
      </Button>
    </form>
  );
}
