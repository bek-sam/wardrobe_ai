import { CloudRain, Wind } from "@phosphor-icons/react";

import type { WeatherView } from "./today.types";

export function WeatherCardFacts({ weather }: { weather: WeatherView }) {
  return (
    <div className="weather-card__facts">
      {weather.rainProbability !== null ? (
        <span>
          <CloudRain size={15} aria-hidden="true" /> {Math.round(weather.rainProbability)}% rain
        </span>
      ) : null}
      {weather.windKph !== null ? (
        <span>
          <Wind size={15} aria-hidden="true" /> {Math.round(weather.windKph)} km/h
        </span>
      ) : null}
      {weather.humidityPercent !== null ? (
        <span>{Math.round(weather.humidityPercent)}% humidity</span>
      ) : null}
    </div>
  );
}
