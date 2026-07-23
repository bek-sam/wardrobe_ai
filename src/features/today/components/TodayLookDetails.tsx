import { RecommendationPreview } from "./RecommendationPreview";
import { TodayLookActions } from "./TodayLookActions";
import { TodayLookNotes } from "./TodayLookNotes";
import { TodayLookReasons } from "./TodayLookReasons";
import { weatherReasons } from "./today-weather-copy";
import type { TodayLookDetailsProps } from "./today.types";

export function TodayLookDetails({
  recommendation,
  recommendationWeather,
  previewImageUrl,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
  saving,
  notice,
  onSave,
}: TodayLookDetailsProps) {
  return (
    <div className="today-look__details">
      <p className="eyebrow">
        {recommendation.occasion ?? "Open day"}
        {recommendationWeather?.locationName ? ` · ${recommendationWeather.locationName}` : ""}
        {` · ${Math.round(recommendation.confidence * 100)}% confidence`}
      </p>
      <h2 id="today-look-title">{recommendation.title}</h2>
      <p className="today-look__summary">{recommendation.explanation}</p>
      {recommendation.preview ? (
        <RecommendationPreview
          onRequestPreview={onRequestPreview}
          preview={recommendation.preview}
          previewImageUrl={previewImageUrl}
          previewNotice={previewNotice}
          previewRequestBusy={previewRequestBusy}
        />
      ) : null}
      <TodayLookReasons
        reasons={weatherReasons(recommendationWeather)}
        warnings={recommendation.warnings}
      />
      <TodayLookNotes recommendation={recommendation} />
      <TodayLookActions
        notice={notice}
        onSave={onSave}
        saved={Boolean(recommendation.savedOutfitId)}
        saving={saving}
      />
    </div>
  );
}
