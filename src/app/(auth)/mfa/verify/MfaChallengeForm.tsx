"use client";

import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { useMfaChallenge } from "./use-mfa-challenge";

type Factor = { id: string; label: string };

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
