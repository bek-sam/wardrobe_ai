"use client";

import { Button } from "@/components/ui/Button";

/**
 * Generation is always an explicit user action. Consent alone never starts one,
 * which is why this idle state exists rather than auto-generating on arrival.
 */
export function TryOnIdle({
  notice,
  busy,
  onStart,
}: {
  notice: string | null;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <div className="tryon-empty">
      <p>See this exact outfit on you, generated privately.</p>
      {notice ? (
        <p aria-live="polite" className="tryon-empty__notice">
          {notice}
        </p>
      ) : null}
      <Button disabled={busy} onClick={onStart}>
        {busy ? "Starting…" : "Try it on"}
      </Button>
    </div>
  );
}

export function TryOnBlockedByCutout() {
  return (
    <p className="inline-feedback">
      <span>
        One piece in this look has no cut-out photo yet, so it cannot be rendered. Re-import it
        through the photo flow to enable try-on.
      </span>
    </p>
  );
}
