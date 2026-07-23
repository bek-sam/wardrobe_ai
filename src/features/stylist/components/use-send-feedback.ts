import { requestJson } from "@/lib/api/request";

import type { useStylistSession } from "./use-stylist-session";

export function useSendFeedback(session: ReturnType<typeof useStylistSession>) {
  return async function sendFeedback(kind: "like" | "dislike") {
    if (!session.savedOutfitId || session.feedbackBusy) return;
    session.setFeedbackBusy(true);
    session.setError(null);
    try {
      await requestJson<unknown>(
        `/api/outfits/${encodeURIComponent(session.savedOutfitId)}/feedback`,
        { method: "POST", body: JSON.stringify({ feedback_type: kind, comment: null }) },
      );
      session.setFeedback(kind);
    } catch (caught) {
      session.setError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      session.setFeedbackBusy(false);
    }
  };
}
