import { SpinnerGap } from "@phosphor-icons/react";

export function WeatherCardLoading() {
  return (
    <section className="weather-card weather-card--status" aria-busy="true" role="status">
      <SpinnerGap className="spin" size={34} aria-hidden="true" />
      <div>
        <h2>Loading today’s weather…</h2>
        <p>Using your saved location and comfort settings.</p>
      </div>
    </section>
  );
}
