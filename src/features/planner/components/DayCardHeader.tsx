import { WeatherIcon } from "./WeatherIcon";
import { temperatureLabel } from "./planner-temperature";
import type { WeatherView } from "./planner.types";

export function DayCardHeader({
  weekday,
  dayOfMonth,
  weather,
  temperatureUnit,
}: {
  weekday: string;
  dayOfMonth: number;
  weather: WeatherView | null;
  temperatureUnit: "celsius" | "fahrenheit";
}) {
  return (
    <header>
      <div>
        <span>{weekday}</span>
        <strong>{dayOfMonth}</strong>
      </div>
      <div title={weather ? `${weather.rainProbability ?? 0}% rain` : "Weather unavailable"}>
        <WeatherIcon weather={weather} />
        <span>{temperatureLabel(weather, temperatureUnit)}</span>
      </div>
    </header>
  );
}
