import { isObject, safeString } from "@/lib/api/normalize";

import { safeTimestamp } from "./stylist-normalize-primitives";
import { uuidPattern } from "./stylist-constants.data";
import type { ConversationSummary } from "./stylist.types";

export function normalizeConversation(value: unknown): ConversationSummary | null {
  if (!isObject(value)) return null;
  const id = safeString(value.id);
  const createdAt = safeTimestamp(value.created_at);
  const updatedAt = safeTimestamp(value.updated_at);
  if (!uuidPattern.test(id) || !createdAt || !updatedAt) return null;
  return { id, title: safeString(value.title, "Conversation").slice(0, 160), createdAt, updatedAt };
}

export function normalizeConversationList(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.conversations)) return null;
  const conversations = value.conversations
    .map(normalizeConversation)
    .filter((conversation): conversation is ConversationSummary => Boolean(conversation));
  return {
    conversations,
    count:
      typeof value.count === "number" && Number.isInteger(value.count)
        ? Math.max(0, value.count)
        : conversations.length,
  };
}

export function conversationOptionLabel(conversation: ConversationSummary) {
  const date = new Date(conversation.updatedAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
    : "Recent";
  return `${conversation.title} · ${dateLabel}`;
}
