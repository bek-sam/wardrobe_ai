import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAndSetConversations } from "./fetch-and-set-conversations";
import type { ConversationSummary } from "./stylist.types";

export function useConversationList(supabaseConfigured: boolean) {
  const historyListAbortRef = useRef<AbortController | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [historyListLoading, setHistoryListLoading] = useState(supabaseConfigured);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadConversationList = useCallback(async () => {
    if (!supabaseConfigured) return;
    historyListAbortRef.current?.abort();
    const controller = new AbortController();
    historyListAbortRef.current = controller;
    setHistoryListLoading(true);
    setHistoryError(null);
    try {
      await fetchAndSetConversations(controller, setConversations, setConversationCount);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setHistoryError(
        caught instanceof Error ? caught.message : "Recent conversations could not be loaded.",
      );
    } finally {
      if (historyListAbortRef.current === controller) {
        historyListAbortRef.current = null;
        setHistoryListLoading(false);
      }
    }
  }, [supabaseConfigured]);

  useEffect(() => {
    const timeout = supabaseConfigured
      ? window.setTimeout(() => void loadConversationList(), 0)
      : undefined;
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      historyListAbortRef.current?.abort();
    };
  }, [loadConversationList, supabaseConfigured]);

  return {
    conversations,
    conversationCount,
    historyListLoading,
    historyError,
    setHistoryError,
    loadConversationList,
    historyListAbortRef,
  };
}
