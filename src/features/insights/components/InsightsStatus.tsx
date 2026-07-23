import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function InsightsStatus({
  error,
  loading,
  onRetry,
}: {
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} />
          <span>{error}</span>
          <Button onClick={onRetry} variant="ghost">
            Try again
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div className="inline-feedback" role="status">
          <SpinnerGap className="spin" size={17} />
          <span>Calculating wardrobe insights…</span>
        </div>
      ) : null}
    </>
  );
}
