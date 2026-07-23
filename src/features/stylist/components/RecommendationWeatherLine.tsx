import { CloudRain } from "@phosphor-icons/react";

import type { WeatherView } from "./stylist.types";

export function RecommendationWeatherLine({ weather }: { weather: WeatherView }) {
  return (
    <div className="recommendation-weather">
      <CloudRain size={16} />
      <span>
        {weather.minimumC !== null && weather.maximumC !== null
          ? `${Math.round(weather.minimumC)}–${Math.round(weather.maximumC)}°C`
          : "Weather context available"}
        {weather.rainProbability !== null ? ` · ${Math.round(weather.rainProbability)}% rain` : ""}
      </span>
    </div>
  );
}
