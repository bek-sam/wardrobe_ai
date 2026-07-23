import { CloudRain, ThermometerSimple } from "@phosphor-icons/react";

import { temperature } from "./today-temperature";
import type { TodayProfile, WeatherView } from "./today.types";

export function WeatherCardForecast({
  weather,
  unit,
  wet,
}: {
  weather: WeatherView;
  unit: TodayProfile["temperatureUnit"];
  wet: boolean;
}) {
  const mainTemperature = temperature(weather.temperatureC, unit);
  const minimum = temperature(weather.minimumC, unit);
  const maximum = temperature(weather.maximumC, unit);
  const range = minimum && maximum ? `${minimum}–${maximum}` : (minimum ?? maximum);

  return (
    <div className="weather-card__forecast">
      {wet ? (
        <CloudRain size={48} weight="duotone" aria-hidden="true" />
      ) : (
        <ThermometerSimple size={48} weight="duotone" aria-hidden="true" />
      )}
      <div>
        <strong>{mainTemperature ?? range ?? "—"}</strong>
        <span>
          {weather.feelsLikeC !== null
            ? `Feels like ${temperature(weather.feelsLikeC, unit)}`
            : range && mainTemperature
              ? `Range ${range}`
              : "Forecast range unavailable"}
        </span>
      </div>
    </div>
  );
}
