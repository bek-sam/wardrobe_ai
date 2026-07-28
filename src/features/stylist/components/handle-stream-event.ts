import { isObject, safeString } from "@/lib/api/normalize";

import { applyAnswerResult } from "./apply-answer-result";
import { applyOutfitResult } from "./apply-outfit-result";
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

  // Plans, packing lists, insights, and item lookups are transcript answers;
  // only an outfit result drives the recommendation panel.
  if (applyAnswerResult(streamEvent.data, session)) return true;
  return applyOutfitResult(streamEvent.data, session, signal);
}
