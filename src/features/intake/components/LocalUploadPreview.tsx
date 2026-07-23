import { titleCase } from "./import-text-helpers";

export function LocalUploadPreview({
  localPreviewUrl,
  uploadStage,
}: {
  localPreviewUrl: string;
  uploadStage: string;
}) {
  return (
    <div className="local-upload-preview" aria-live="polite">
      {/* Blob URLs are local-only previews and are revoked after signing or unmount. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Selected upload preview" src={localPreviewUrl} />
      <span>{titleCase(uploadStage)}</span>
    </div>
  );
}
