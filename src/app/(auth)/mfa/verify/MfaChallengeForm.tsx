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
