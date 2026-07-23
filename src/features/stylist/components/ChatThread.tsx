import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatThinkingIndicator } from "./ChatThinkingIndicator";
import type { ChatMessage } from "./stylist.types";

export function ChatThread({
  messages,
  streamState,
  historyTranscriptLoading,
}: {
  messages: ChatMessage[];
  streamState: "idle" | "thinking" | "details";
  historyTranscriptLoading: boolean;
}) {
  return (
    <div className="chat-thread" aria-live="polite">
      {!messages.length && streamState === "idle" && !historyTranscriptLoading ? (
        <ChatEmptyState />
      ) : null}
      {messages.map((entry) => (
        <ChatMessageItem entry={entry} key={entry.id} />
      ))}
      {streamState !== "idle" ? <ChatThinkingIndicator streamState={streamState} /> : null}
    </div>
  );
}
