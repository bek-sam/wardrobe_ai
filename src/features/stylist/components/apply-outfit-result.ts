import { fetchItemDetails } from "./fetch-item-details";
import { normalizeRecommendation } from "./normalize-stylist-recommendation";
import { currentTime } from "./stylist-time";
import type { useStylistSession } from "./use-stylist-session";

export async function applyOutfitResult(
  data: unknown,
  session: ReturnType<typeof useStylistSession>,
  signal: AbortSignal,
) {
  const normalized = normalizeRecommendation(data);
  if (!normalized) throw new Error("The stylist returned an invalid recommendation.");
  session.setConversationId(normalized.conversationId);
  session.setStreamState("details");
  const itemDetails = await fetchItemDetails(normalized.items, signal);
  session.setRecommendation({ ...normalized, itemDetails });
  session.setMessages((current) => [
    ...current,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: normalized.explanation,
      note: normalized.warnings[0] ?? normalized.followUpQuestion,
      time: currentTime(),
    },
  ]);
  return true;
}
