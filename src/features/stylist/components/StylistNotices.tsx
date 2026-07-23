import { Check, WarningCircle } from "@phosphor-icons/react";

export function StylistNotices({
  historyError,
  historyNotice,
  error,
}: {
  historyError: string | null;
  historyNotice: string | null;
  error: string | null;
}) {
  return (
    <>
      {historyError ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{historyError}</span>
        </div>
      ) : null}
      {historyNotice ? (
        <div className="inline-feedback" role="status">
          <Check size={16} /> <span>{historyNotice}</span>
        </div>
      ) : null}
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{error}</span>
        </div>
      ) : null}
    </>
  );
}
