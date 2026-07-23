import { consumeSse } from "../sse";

import { buildChatRequestBody } from "./build-chat-request-body";
import { handleStreamEvent } from "./handle-stream-event";
import type { useStylingContext } from "./use-styling-context";
import type { useStylistSession } from "./use-stylist-session";

export async function runChatStream(
  requestMessage: string,
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
  signal: AbortSignal,
) {
  const response = await fetch("/api/stylist/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(buildChatRequestBody(requestMessage, session.conversationId, styling)),
    signal,
  });
  let receivedResult = false;
  await consumeSse(response, async (streamEvent) => {
    if (await handleStreamEvent(streamEvent, session, signal)) receivedResult = true;
  });
  if (!receivedResult) throw new Error("The stylist stream ended before a recommendation arrived.");
}
