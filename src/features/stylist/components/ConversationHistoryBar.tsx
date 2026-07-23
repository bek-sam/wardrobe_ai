import { Button } from "@/components/ui/Button";

import { conversationOptionLabel } from "./normalize-conversation";
import type { ConversationHistoryBarProps } from "./stylist.types";

export function ConversationHistoryBar({
  conversations,
  conversationCount,
  conversationId,
  currentConversationIsListed,
  disabled,
  historyListLoading,
  onSelect,
  onRefresh,
}: ConversationHistoryBarProps) {
  return (
    <div className="stylist-history-bar">
      <label>
        <span>Recent chats</span>
        <select
          disabled={disabled}
          onChange={(event) => onSelect(event.target.value)}
          value={conversationId ?? ""}
        >
          <option value="">New conversation</option>
          {conversationId && !currentConversationIsListed ? (
            <option value={conversationId}>Current conversation</option>
          ) : null}
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversationOptionLabel(conversation)}
            </option>
          ))}
        </select>
      </label>
      <span role="status">
        {historyListLoading
          ? "Loading recent chats…"
          : `${conversations.length} of ${conversationCount} recent chats`}
      </span>
      <Button disabled={disabled} onClick={onRefresh} variant="ghost">
        Refresh
      </Button>
    </div>
  );
}
