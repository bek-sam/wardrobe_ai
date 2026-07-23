import { Badge } from "@/components/ui/Badge";
import type { TodayPreviewInfo } from "./today.types";

export function RecommendationPreview({
  preview,
  previewImageUrl,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
}: {
  preview: TodayPreviewInfo;
  previewImageUrl: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
}) {
  return (
    <div className="recommendation-preview">
      {preview.styleTags.length ? (
        <div className="recommendation-preview__tags">
          {preview.styleTags.map((tag) => (
            <Badge key={tag} tone="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Modeled preview of this outfit"
          className="recommendation-preview__image"
          src={previewImageUrl}
        />
      ) : preview.status === "queued" || preview.status === "generating" ? (
        <p className="recommendation-preview__status">Modeled preview is generating…</p>
      ) : preview.status === "failed" ? (
        <p className="recommendation-preview__status">The last preview attempt failed.</p>
      ) : (
        <button
          className="recommendation-preview__request"
          disabled={previewRequestBusy}
          onClick={onRequestPreview}
          type="button"
        >
          {previewRequestBusy ? "Requesting…" : "Generate a modeled preview"}
        </button>
      )}
      {previewNotice ? <small>{previewNotice}</small> : null}
    </div>
  );
}
