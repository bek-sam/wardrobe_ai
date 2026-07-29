import { useState } from "react";
import type { MutableRefObject } from "react";

import { loadConversationTranscript } from "./load-conversation-transcript";
import { uuidPattern } from "./stylist-constants.data";
import type { useStylistSession } from "./use-stylist-session";

export function useLoadConversation(
  session: ReturnType<typeof useStylistSession>,
  abortRef: MutableRefObject<AbortController | null>,
) {
  const [historyTranscriptLoading, setHistoryTranscriptLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function loadConversation(nextConversationId: string) {
    if (!uuidPattern.test(nextConversationId) || session.streamState !== "idle") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setHistoryTranscriptLoading(true);
    session.setStreamState("details");
    setHistoryError(null);
    session.setHistoryNotice(null);
    session.setConversationId(nextConversationId);
    session.setMessages([]);
    session.setRecommendation(null);
    session.setSavedOutfitId(null);
    session.setFeedback(null);
    session.setPlanned(false);
    session.setSwap(null);
    try {
      const result = await loadConversationTranscript(nextConversationId, controller.signal);
      session.setMessages(result.messages);
      if (result.recommendation) session.setRecommendation(result.recommendation);
      if (!controller.signal.aborted) session.setHistoryNotice(result.notice);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setHistoryError(
        caught instanceof Error ? caught.message : "The conversation could not be loaded.",
      );
    } finally {
      // Always cleared, even when this load was superseded: nothing else owns
      // this flag, and `busy` in ChatPanel includes it — leaving it set locks
      // the composer for the rest of the page's life. The stream state is the
      // opposite case: whoever took over owns it now, and forcing it to "idle"
      // here would re-enable the composer in the middle of their request.
      setHistoryTranscriptLoading(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
        session.setStreamState("idle");
      }
    }
  }

  return { historyTranscriptLoading, historyError, setHistoryError, loadConversation };
}
