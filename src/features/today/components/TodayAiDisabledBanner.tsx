import { WarningCircle } from "@phosphor-icons/react";

export function TodayAiDisabledBanner({ aiConfigured }: { aiConfigured: boolean }) {
  if (aiConfigured) return null;
  return (
    <div className="inline-feedback inline-feedback--error" role="status">
      <WarningCircle size={17} aria-hidden="true" />
      <span>
        Live wardrobe and weather data are available, but outfit generation requires the server’s
        OpenAI stylist configuration.
      </span>
    </div>
  );
}
