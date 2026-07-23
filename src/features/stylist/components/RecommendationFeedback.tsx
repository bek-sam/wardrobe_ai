import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";

export function RecommendationFeedback({
  savedOutfitId,
  generationId,
  feedback,
  feedbackBusy,
  onFeedback,
}: {
  savedOutfitId: string | null;
  generationId: string | null;
  feedback: "like" | "dislike" | null;
  feedbackBusy: boolean;
  onFeedback: (kind: "like" | "dislike") => void;
}) {
  if (!savedOutfitId) {
    return (
      <p className="recommendation-save-hint">
        {generationId
          ? "Save the outfit to enable swaps and feedback."
          : "Continue this chat to create a new look that can be saved."}
      </p>
    );
  }
  return (
    <div className="recommendation-feedback" aria-label="Outfit feedback">
      <span>Was this useful?</span>
      <button
        aria-label="Like outfit"
        aria-pressed={feedback === "like"}
        className={feedback === "like" ? "is-active" : ""}
        disabled={feedbackBusy}
        onClick={() => onFeedback("like")}
        type="button"
      >
        <ThumbsUp size={15} />
      </button>
      <button
        aria-label="Dislike outfit"
        aria-pressed={feedback === "dislike"}
        className={feedback === "dislike" ? "is-active" : ""}
        disabled={feedbackBusy}
        onClick={() => onFeedback("dislike")}
        type="button"
      >
        <ThumbsDown size={15} />
      </button>
    </div>
  );
}
