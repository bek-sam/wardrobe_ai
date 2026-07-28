import { useRef } from "react";

import type { StylistCapabilities } from "../capabilities";

import { useChatSubmit } from "./use-chat-submit";
import { useConversationList } from "./use-conversation-list";
import { useLoadConversation } from "./use-load-conversation";
import { useOutfitActions } from "./use-outfit-actions";
import { useStylingContext } from "./use-styling-context";
import { useStylistPreview } from "./use-stylist-preview";
import { useStylistSession } from "./use-stylist-session";

export function useStylistWorkspaceState(
  supabaseConfigured: boolean,
  capabilities: StylistCapabilities,
  initialDate: string,
) {
  const historyTranscriptAbortRef = useRef<AbortController | null>(null);
  const session = useStylistSession(historyTranscriptAbortRef);
  const styling = useStylingContext(initialDate);
  const list = useConversationList(supabaseConfigured);
  const loader = useLoadConversation(session, historyTranscriptAbortRef);
  // Chat is enabled by the account, not by a model: the wardrobe-lookup and
  // insight routes never call OpenAI, so disabling the composer when only the
  // generation models are missing would remove features that still work.
  const chatAvailable = supabaseConfigured && capabilities.chatAvailable;
  const chat = useChatSubmit(
    session,
    styling,
    chatAvailable,
    loader.historyTranscriptLoading,
    () => void list.loadConversationList(),
  );
  const preview = useStylistPreview(session.recommendation);
  const actions = useOutfitActions(session, styling);
  const busy =
    session.streamState !== "idle" ||
    loader.historyTranscriptLoading ||
    session.saving ||
    session.feedbackBusy ||
    session.swapBusy;

  return {
    session,
    styling,
    list,
    loader,
    chat,
    preview,
    actions,
    capabilities,
    chatAvailable,
    busy,
  };
}
