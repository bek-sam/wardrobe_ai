import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";

import type { StylistRecommendationPreviewProps } from "./stylist.types";

export function StylistRecommendationPreview({
  preview,
  previewStatus,
  previewImageUrl,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
}: StylistRecommendationPreviewProps) {
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
      ) : previewStatus === "queued" || previewStatus === "generating" ? (
        <p className="recommendation-preview__status">
          <SpinnerGap className="spin" size={14} /> Modeled preview is generating…
        </p>
      ) : previewStatus === "failed" ? (
        <p className="recommendation-preview__status">
          <WarningCircle size={14} /> The last preview attempt failed.
        </p>
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
