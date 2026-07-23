export function OriginalImageReview({ originalImageUrl }: { originalImageUrl: string }) {
  return (
    <details className="original-image-review">
      <summary>View private original</summary>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Original import" src={originalImageUrl} />
    </details>
  );
}
