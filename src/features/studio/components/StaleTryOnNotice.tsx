"use client";

import { Button } from "@/components/ui/Button";

/**
 * A stale image is never presented as current. The old visualization stays
 * visible — it is still useful context — but it is labelled and paired with
 * the one action that fixes it.
 */
export function StaleTryOnNotice({
  staleReason,
  busy,
  onRegenerate,
}: {
  staleReason: string | null;
  busy: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="tryon-notice tryon-notice--stale" role="status">
      <p className="tryon-notice__title">This try-on is out of date.</p>
      <p className="tryon-notice__detail">
        {staleReason === "identity_reference_replaced"
          ? "You changed your reference photo, so this image no longer shows you."
          : "A piece in this look changed, so this image no longer shows the current outfit."}
      </p>
      <Button className="button--small" disabled={busy} onClick={onRegenerate}>
        Update try-on
      </Button>
    </div>
  );
}
