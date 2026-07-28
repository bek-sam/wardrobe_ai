import { useRef } from "react";
import type { FormEvent } from "react";

import { resetForSubmit } from "./reset-for-submit";
import { runChatStream } from "./run-chat-stream";
import type { useStylingContext } from "./use-styling-context";
import type { useStylistSession } from "./use-stylist-session";

export function useChatSubmit(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
  chatAvailable: boolean,
  historyTranscriptLoading: boolean,
  onDone: () => void,
) {
  const abortRef = useRef<AbortController | null>(null);

  async function submit(event?: FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const requestMessage = (prompt ?? styling.message).trim();
    if (
      !chatAvailable ||
      !requestMessage ||
      !styling.date ||
      session.streamState !== "idle" ||
      historyTranscriptLoading
    )
      return;
    const controller = new AbortController();
    abortRef.current = controller;
    resetForSubmit(session, styling, requestMessage);
    try {
      await runChatStream(requestMessage, session, styling, controller.signal);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      session.setError(
        caught instanceof Error ? caught.message : "The stylist request could not be completed.",
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      session.setStreamState("idle");
      if (!controller.signal.aborted) onDone();
    }
  }

  return { submit, abortRef };
}
