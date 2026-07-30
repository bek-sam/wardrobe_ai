import type { TodayRecommendation, WeatherView } from "./today.types";

export function TodayLookHeader({
  recommendation,
  recommendationWeather,
}: {
  recommendation: TodayRecommendation;
  recommendationWeather: WeatherView | null;
}) {
  return (
    <>
      <p className="eyebrow">
        {recommendation.occasion ?? "Open day"}
        {recommendationWeather?.locationName ? ` · ${recommendationWeather.locationName}` : ""}
        {` · ${Math.round(recommendation.confidence * 100)}% confidence`}
      </p>
      <h2 id="today-look-title">{recommendation.title}</h2>
      <p className="today-look__summary">{recommendation.explanation}</p>
    </>
  );
}
