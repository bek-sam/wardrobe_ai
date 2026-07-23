import { isObject, safeString } from "@/lib/api/normalize";

import { fetchItemDetails } from "./fetch-item-details";
import { normalizeRecommendation } from "./normalize-stylist-recommendation";
import { currentTime } from "./stylist-time";
import { uuidPattern } from "./stylist-constants.data";
import type { useStylistSession } from "./use-stylist-session";

type StreamEvent = { name: string; data: unknown };

export async function handleStreamEvent(
  streamEvent: StreamEvent,
  session: ReturnType<typeof useStylistSession>,
  signal: AbortSignal,
): Promise<boolean> {
  if (streamEvent.name === "status" && isObject(streamEvent.data)) {
    const nextConversationId = safeString(streamEvent.data.conversationId);
    if (uuidPattern.test(nextConversationId)) session.setConversationId(nextConversationId);
    session.setStreamState("thinking");
    return false;
  }
  if (streamEvent.name === "error") {
    const streamMessage = isObject(streamEvent.data) ? safeString(streamEvent.data.message) : "";
    throw new Error(streamMessage || "A wardrobe recommendation could not be completed.");
  }
  if (streamEvent.name !== "result") return false;

  const normalized = normalizeRecommendation(streamEvent.data);
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
