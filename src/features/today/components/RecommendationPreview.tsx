import { previewLabel } from "./preview-label";
import { RecommendationPreviewTags } from "./RecommendationPreviewTags";
import type { TodayPreviewInfo } from "./today.types";

export function RecommendationPreview({
  preview,
  previewImageUrl,
  previewStatus,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
}: {
  preview: TodayPreviewInfo;
  previewImageUrl: string | null;
  previewStatus: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
}) {
  return (
    <div className="recommendation-preview">
      <RecommendationPreviewTags styleTags={preview.styleTags} />
      {previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Modeled preview of this outfit"
          className="recommendation-preview__image"
          src={previewImageUrl}
        />
      ) : previewRequestBusy ? (
        <p className="recommendation-preview__status">Modeled preview is generating…</p>
      ) : (
        // Every state short of `ready` stays actionable. A queued job is only
        // drained by a scheduler that need not exist or by this control, so
        // hiding it here is what stranded auto-enqueued previews on a
        // "generating…" that nothing was advancing -- and `failed` offered no
        // way back at all. Enqueuing is deduplicated server-side, so pressing
        // this against an existing job resumes it rather than duplicating it.
        <button
          className="recommendation-preview__request"
          onClick={onRequestPreview}
          type="button"
        >
          {previewLabel(previewStatus)}
        </button>
      )}
      {previewNotice ? <small>{previewNotice}</small> : null}
    </div>
  );
}
