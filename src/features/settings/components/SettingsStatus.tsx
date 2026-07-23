import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import type { Notice } from "./settings.types";

export function SettingsStatus({
  notice,
  loading,
  onRetry,
}: {
  notice: Notice | null;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {notice ? (
        <div
          className={`inline-feedback inline-feedback--${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "error" ? <WarningCircle size={17} /> : <CheckCircle size={17} />}
          <span>{notice.message}</span>
          {notice.tone === "error" && !loading ? (
            <Button onClick={onRetry} variant="ghost">
              Reload
            </Button>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div className="inline-feedback" role="status">
          <SpinnerGap className="spin" size={17} />
          <span>Loading your private settings…</span>
        </div>
      ) : null}
    </>
  );
}
