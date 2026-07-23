import { isObject, safeString } from "@/lib/api/normalize";

import { normalizeConversation } from "./normalize-conversation";
import { historyTime } from "./stylist-time";
import { safeTimestamp } from "./stylist-normalize-primitives";
import { uuidPattern } from "./stylist-constants.data";
import type { ChatMessage, ConversationTranscript } from "./stylist.types";

export function normalizeConversationTranscript(
  value: unknown,
  expectedConversationId: string,
): ConversationTranscript | null {
  if (!isObject(value) || !Array.isArray(value.messages)) return null;
  const conversation = normalizeConversation(value.conversation);
  if (!conversation || conversation.id !== expectedConversationId) return null;
  const messages = value.messages.flatMap((entry): ChatMessage[] => {
    if (!isObject(entry)) return [];
    const id = safeString(entry.id);
    const role = entry.role;
    const content = safeString(entry.content);
    const createdAt = safeTimestamp(entry.created_at);
    if (!uuidPattern.test(id) || (role !== "user" && role !== "assistant") || !createdAt) return [];
    return [
      {
        id,
        role,
        content,
        time: historyTime(createdAt),
        structuredResult: role === "assistant" ? entry.structured_result : null,
      },
    ];
  });
  return {
    conversation,
    messages,
    count:
      typeof value.count === "number" && Number.isInteger(value.count)
        ? Math.max(0, value.count)
        : messages.length,
    hasEarlierMessages: value.hasEarlierMessages === true,
  };
}
