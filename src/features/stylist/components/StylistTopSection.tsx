import { ConversationHistoryBar } from "./ConversationHistoryBar";
import { StylingContextForm } from "./StylingContextForm";
import { StylistAiDisabledNotice } from "./StylistAiDisabledNotice";
import { StylistHeader } from "./StylistHeader";
import { StylistNotices } from "./StylistNotices";
import type { useStylistWorkspaceState } from "./use-stylist-workspace-state";

export function StylistTopSection({
  state,
  aiConfigured,
  busy,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
  aiConfigured: boolean;
  busy: boolean;
}) {
  const { session, styling, list, loader } = state;
  const currentConversationIsListed = list.conversations.some(
    (conversation) => conversation.id === session.conversationId,
  );
  return (
    <>
      <StylistHeader
        aiAvailable={state.aiAvailable}
        onReset={session.resetConversation}
        resetDisabled={busy}
        showReset={Boolean(session.messages.length || session.conversationId)}
      />
      <StylistAiDisabledNotice aiConfigured={aiConfigured} />
      <ConversationHistoryBar
        conversationCount={list.conversationCount}
        conversationId={session.conversationId}
        conversations={list.conversations}
        currentConversationIsListed={currentConversationIsListed}
        disabled={busy}
        historyListLoading={list.historyListLoading}
        onRefresh={() => void list.loadConversationList()}
        onSelect={(nextId) =>
          nextId ? void loader.loadConversation(nextId) : session.resetConversation()
        }
      />
      <StylistNotices
        error={session.error}
        historyError={loader.historyError}
        historyNotice={session.historyNotice}
      />
      <StylingContextForm styling={styling} />
    </>
  );
}
