"use client";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { useEmailChange } from "./use-email-change";

/**
 * Starts a double-confirmed email change.
 *
 * Nothing has changed when this succeeds — both the current and the new
 * mailbox must confirm first. The copy says so, because reporting plain
 * "success" here would leave users believing their address had already moved.
 */
export function EmailChangePanel({ onRequested }: { onRequested: (message: string) => void }) {
  const form = useEmailChange(onRequested);

  return (
    <div className="security-panel">
      <h3>Change email address</h3>
      {form.error ? (
        <p className="form-field__error" role="alert">
          {form.error}
        </p>
      ) : null}
      <TextField
        autoComplete="email"
        hint="We email both your current and new address. The current one keeps working until both confirm."
        id="security-new-email"
        label="New email address"
        onChange={(event) => form.setNewEmail(event.target.value)}
        placeholder="you@example.com"
        type="email"
        value={form.newEmail}
      />
      <Button
        disabled={form.pending || form.newEmail.length === 0}
        onClick={() => void form.submit()}
      >
        {form.pending ? "Sending…" : "Send confirmation emails"}
      </Button>
    </div>
  );
}
