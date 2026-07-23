import { WeatherCardLoading } from "./WeatherCardLoading";
import { WeatherCardReady } from "./WeatherCardReady";
import { WeatherCardUnavailable } from "./WeatherCardUnavailable";
import type { TodayProfile, WeatherView } from "./today.types";

export function TodayWeatherCard({
  weather,
  loading,
  error,
  profile,
  onRetry,
}: {
  weather: WeatherView | null;
  loading: boolean;
  error: string | null;
  profile: TodayProfile | null;
  onRetry: () => void;
}) {
  if (loading) return <WeatherCardLoading />;
  if (!weather) return <WeatherCardUnavailable error={error} onRetry={onRetry} />;
  return (
    <WeatherCardReady
      profile={profile}
      unit={profile?.temperatureUnit ?? "fahrenheit"}
      weather={weather}
    />
  );
}
