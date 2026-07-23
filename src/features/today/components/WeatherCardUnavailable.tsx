import { WarningCircle } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function WeatherCardUnavailable({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="weather-card weather-card--status" aria-labelledby="weather-title">
      <WarningCircle size={34} aria-hidden="true" />
      <div>
        <h2 id="weather-title">Weather context unavailable</h2>
        <p>{error ?? "Add a home location to use weather-aware recommendations."}</p>
        <div className="weather-card__status-actions">
          <Button onClick={onRetry} variant="secondary">
            Try again
          </Button>
          <ButtonLink href="/settings" variant="ghost">
            Check location
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
