import { fetchConversationList } from "./fetch-conversation-list";
import type { ConversationSummary } from "./stylist.types";

export async function fetchAndSetConversations(
  controller: AbortController,
  setConversations: (value: ConversationSummary[]) => void,
  setConversationCount: (value: number) => void,
) {
  const normalized = await fetchConversationList(controller.signal);
  if (!controller.signal.aborted) {
    setConversations(normalized.conversations);
    setConversationCount(normalized.count);
  }
}
