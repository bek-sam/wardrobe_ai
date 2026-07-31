"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

import { submitFeedback } from "../api/tryon-client";

const REASONS = [
  { value: "looks_like_me", label: "Looks like me" },
  { value: "does_not_look_like_me", label: "Doesn't look like me" },
  { value: "wrong_garment", label: "Wrong garment" },
  { value: "missing_garment", label: "Missing garment" },
  { value: "bad_anatomy", label: "Bad anatomy or pose" },
  { value: "styling_not_for_me", label: "Styling isn't for me" },
  { value: "other", label: "Something else" },
] as const;

export function TryOnFeedback({ visualizationId }: { visualizationId: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (reason: string) => {
    setBusy(true);
    try {
      await submitFeedback(visualizationId, reason, null);
      setSent(reason);
    } catch {
      setSent(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tryon-feedback">
      <p className="tryon-feedback__label">How did this turn out?</p>
      <div className="tryon-feedback__options">
        {REASONS.map((reason) => (
          <Button
            className="button--small"
            disabled={busy}
            key={reason.value}
            onClick={() => void send(reason.value)}
            variant={sent === reason.value ? "secondary" : "ghost"}
          >
            {reason.label}
          </Button>
        ))}
      </div>
      <p aria-live="polite" className="tryon-feedback__ack">
        {sent ? "Thanks — that helps us improve the try-on." : ""}
      </p>
    </div>
  );
}
