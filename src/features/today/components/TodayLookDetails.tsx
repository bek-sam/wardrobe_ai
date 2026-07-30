import { RecommendationPreview } from "./RecommendationPreview";
import { TodayLookActions } from "./TodayLookActions";
import { TodayLookHeader } from "./TodayLookHeader";
import { TodayLookNotes } from "./TodayLookNotes";
import { TodayLookReasons } from "./TodayLookReasons";
import { weatherReasons } from "./today-weather-copy";
import type { TodayLookDetailsProps } from "./today.types";

export function TodayLookDetails({
  recommendation,
  recommendationWeather,
  previewImageUrl,
  previewStatus,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
  saving,
  notice,
  onSave,
}: TodayLookDetailsProps) {
  return (
    <div className="today-look__details">
      <TodayLookHeader
        recommendation={recommendation}
        recommendationWeather={recommendationWeather}
      />
      {recommendation.preview ? (
        <RecommendationPreview
          onRequestPreview={onRequestPreview}
          preview={recommendation.preview}
          previewImageUrl={previewImageUrl}
          previewNotice={previewNotice}
          previewRequestBusy={previewRequestBusy}
          previewStatus={previewStatus}
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
