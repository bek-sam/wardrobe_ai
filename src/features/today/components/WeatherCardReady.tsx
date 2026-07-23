import { MapPin } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";

import { WeatherCardFacts } from "./WeatherCardFacts";
import { WeatherCardForecast } from "./WeatherCardForecast";
import { weatherHeadline, weatherReasons } from "./today-weather-copy";
import type { TodayProfile, WeatherView } from "./today.types";

export function WeatherCardReady({
  weather,
  profile,
  unit,
}: {
  weather: WeatherView;
  profile: TodayProfile | null;
  unit: TodayProfile["temperatureUnit"];
}) {
  const reasons = weatherReasons(weather);
  const wet = (weather.rainProbability ?? 0) >= 40 || (weather.precipitationMm ?? 0) >= 0.5;

  return (
    <section className="weather-card" aria-labelledby="weather-title">
      <div className="weather-card__topline">
        <span>
          <MapPin size={14} aria-hidden="true" />
          {weather.locationName ?? profile?.locationName ?? "Saved location"}
        </span>
        <Badge tone="outline">{weather.provider ?? "Live forecast"}</Badge>
      </div>
      <WeatherCardForecast unit={unit} weather={weather} wet={wet} />
      <div className="weather-card__copy">
        <h2 id="weather-title">{weatherHeadline(weather)}</h2>
        <p>{reasons[0] ?? "No special clothing constraints were derived for today."}</p>
      </div>
      <WeatherCardFacts weather={weather} />
    </section>
  );
}
