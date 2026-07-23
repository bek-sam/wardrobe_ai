import { useState } from "react";
import type { MutableRefObject } from "react";

import { useOutfitFeedbackState } from "./use-outfit-feedback-state";
import { useSwapState } from "./use-swap-state";
import type { ChatMessage, Recommendation } from "./stylist.types";

export function useStylistSession(
  historyTranscriptAbortRef: MutableRefObject<AbortController | null>,
) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "thinking" | "details">("idle");
  const [error, setError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const outfitState = useOutfitFeedbackState();
  const swapState = useSwapState();

  function resetConversation() {
    historyTranscriptAbortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setRecommendation(null);
    outfitState.setSavedOutfitId(null);
    outfitState.setFeedback(null);
    outfitState.setPlanned(false);
    swapState.setSwap(null);
    setError(null);
    setHistoryNotice(null);
  }

  return {
    historyTranscriptAbortRef,
    conversationId,
    setConversationId,
    messages,
    setMessages,
    recommendation,
    setRecommendation,
    streamState,
    setStreamState,
    error,
    setError,
    historyNotice,
    setHistoryNotice,
    resetConversation,
    ...outfitState,
    ...swapState,
  };
}
