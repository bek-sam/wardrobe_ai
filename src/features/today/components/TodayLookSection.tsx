import { TodayLookArt } from "./TodayLookArt";
import { TodayLookDetails } from "./TodayLookDetails";
import type { TodayRecommendation, WeatherView } from "./today.types";

export function TodayLookSection({
  recommendation,
  recommendationWeather,
  previewImageUrl,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
  saving,
  notice,
  onSave,
}: {
  recommendation: TodayRecommendation;
  recommendationWeather: WeatherView | null;
  previewImageUrl: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
  saving: boolean;
  notice: string | null;
  onSave: () => void;
}) {
  return (
    <section className="today-look today-look--live" aria-labelledby="today-look-title">
      <TodayLookArt recommendation={recommendation} />
      <TodayLookDetails
        notice={notice}
        onRequestPreview={onRequestPreview}
        onSave={onSave}
        previewImageUrl={previewImageUrl}
        previewNotice={previewNotice}
        previewRequestBusy={previewRequestBusy}
        recommendation={recommendation}
        recommendationWeather={recommendationWeather}
        saving={saving}
      />
    </section>
  );
}
