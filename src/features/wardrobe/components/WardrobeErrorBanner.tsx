import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function WardrobeErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="inline-feedback inline-feedback--error" role="alert">
      <WarningCircle size={17} />
      <span>{error}</span>
      <Button onClick={onRetry} variant="ghost">
        Try again
      </Button>
    </div>
  );
}
