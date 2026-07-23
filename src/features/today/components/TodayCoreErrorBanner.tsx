import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function TodayCoreErrorBanner({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (!error) return null;
  return (
    <div className="inline-feedback inline-feedback--error" role="alert">
      <WarningCircle size={17} aria-hidden="true" />
      <span>{error}</span>
      <Button onClick={onRetry} variant="ghost">
        Retry
      </Button>
    </div>
  );
}
