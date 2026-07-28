import type { FormEvent } from "react";

import { ChatComposer } from "./ChatComposer";
import { ChatContextChips } from "./ChatContextChips";
import { ChatThread } from "./ChatThread";
import { QuickPrompts } from "./QuickPrompts";
import type { useStylingContext } from "./use-styling-context";
import type { useStylistSession } from "./use-stylist-session";

export function ChatPanel({
  session,
  styling,
  chatAvailable,
  historyTranscriptLoading,
  onSubmit,
}: {
  session: ReturnType<typeof useStylistSession>;
  styling: ReturnType<typeof useStylingContext>;
  chatAvailable: boolean;
  historyTranscriptLoading: boolean;
  onSubmit: (event?: FormEvent<HTMLFormElement>, prompt?: string) => void;
}) {
  const busy = !chatAvailable || session.streamState !== "idle" || historyTranscriptLoading;
  return (
    <section className="chat-panel" aria-label="Stylist conversation">
      <ChatContextChips date={styling.date} location={styling.location} />
      <ChatThread
        historyTranscriptLoading={historyTranscriptLoading}
        messages={session.messages}
        streamState={session.streamState}
      />
      <QuickPrompts disabled={busy} onSelect={(prompt) => onSubmit(undefined, prompt)} />
      <ChatComposer
        chatAvailable={chatAvailable}
        canSubmit={!busy && Boolean(styling.message.trim()) && Boolean(styling.date)}
        disabled={busy}
        message={styling.message}
        onMessage={styling.setMessage}
        onSubmit={(event) => onSubmit(event)}
        streamState={session.streamState}
      />
    </section>
  );
}
