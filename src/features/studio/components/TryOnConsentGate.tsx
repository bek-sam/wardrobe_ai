"use client";

import { Button } from "@/components/ui/Button";

import { useIdentity } from "../hooks/use-identity";
import { IdentityConsentStep } from "./IdentityConsentStep";
import { IdentityUploadStep } from "./IdentityUploadStep";

/**
 * Consent enables the feature; it never enqueues a generation. Reaching the
 * "ready" state here only means the user *may* press Try it on.
 */
export function TryOnConsentGate({ onReady }: { onReady: () => void }) {
  const { state, busy, message, upload, activate, revoke } = useIdentity();

  if (!state) return <p className="identity-step__lead">Loading your try-on settings…</p>;
  if (!state.tryOnConfigured) {
    return (
      <p className="inline-feedback">
        <span>AI try-on is not configured on this deployment yet. The flat lay still works.</span>
      </p>
    );
  }

  if (state.active && state.consentCurrent) {
    return (
      <div className="identity-step">
        <h3>AI try-on is on</h3>
        <p className="identity-step__lead">
          Your reference photo is stored privately and used only when you ask for a try-on.
        </p>
        <div className="identity-step__actions">
          <Button onClick={onReady}>Create a try-on</Button>
          <Button disabled={busy} onClick={() => void revoke(true)} variant="danger">
            Turn off and delete my photo
          </Button>
        </div>
        {message ? <p className="identity-step__note">{message}</p> : null}
      </div>
    );
  }

  if (state.pending) {
    return (
      <IdentityConsentStep
        assessmentMessage={message}
        busy={busy}
        onActivate={() => void activate(state.pending!.id)}
        previewUrl={state.previewUrl}
      />
    );
  }

  return <IdentityUploadStep busy={busy} onUpload={(file) => void upload(file)} />;
}
