import { isObject, safeString } from "@/lib/api/normalize";

import { normalizeStylistAnswer } from "./normalize-stylist-answer";
import { currentTime } from "./stylist-time";
import { uuidPattern } from "./stylist-constants.data";
import type { useStylistSession } from "./use-stylist-session";

/**
 * Appends a non-outfit answer to the transcript. Returns false when the
 * payload is an outfit result, leaving it to the recommendation path.
 */
export function applyAnswerResult(
  data: unknown,
  session: ReturnType<typeof useStylistSession>,
): boolean {
  const answer = normalizeStylistAnswer(data);
  if (!answer) return false;

  const conversationId = isObject(data) ? safeString(data.conversationId) : "";
  if (uuidPattern.test(conversationId)) session.setConversationId(conversationId);
  session.setMessages((current) => [
    ...current,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: answer.answer,
      details: answer.details,
      // Live SSE keeps the same structured metadata a reloaded transcript
      // would, so the save action works without refreshing the page.
      plan: answer.plan,
      time: currentTime(),
    },
  ]);
  return true;
}
