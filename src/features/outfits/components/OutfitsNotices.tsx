import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function OutfitsNotices({
  error,
  notice,
  onRetry,
}: {
  error: string | null;
  notice: string | null;
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
      {notice ? (
        <div className="inline-feedback inline-feedback--success" role="status">
          <CheckCircle size={17} />
          <span>{notice}</span>
        </div>
      ) : null}
    </>
  );
}
