import { WarningCircle } from "@phosphor-icons/react";

export function TodayGenerationErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="inline-feedback inline-feedback--error" role="alert">
      <WarningCircle size={17} aria-hidden="true" />
      <span>{error}</span>
    </div>
  );
}
