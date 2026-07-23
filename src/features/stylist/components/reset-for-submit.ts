import { currentTime } from "./stylist-time";
import type { useStylingContext } from "./use-styling-context";
import type { useStylistSession } from "./use-stylist-session";

export function resetForSubmit(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
  requestMessage: string,
) {
  session.setError(null);
  session.setStreamState("thinking");
  session.setRecommendation(null);
  session.setSavedOutfitId(null);
  session.setFeedback(null);
  session.setPlanned(false);
  session.setSwap(null);
  styling.setMessage("");
  session.setMessages((current) => [
    ...current,
    { id: crypto.randomUUID(), role: "user", content: requestMessage, time: currentTime() },
  ]);
}
