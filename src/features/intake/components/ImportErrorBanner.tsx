import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function ImportErrorBanner({
  error,
  showResume,
  onResume,
}: {
  error: string;
  showResume: boolean;
  onResume: () => void;
}) {
  return (
    <div className="inline-feedback inline-feedback--error" role="alert">
      <WarningCircle size={17} />
      <span>{error}</span>
      {showResume ? (
        <Button onClick={onResume} variant="ghost">
          Resume processing
        </Button>
      ) : null}
    </div>
  );
}
