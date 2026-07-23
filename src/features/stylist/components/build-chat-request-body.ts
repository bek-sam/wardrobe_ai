import type { useStylingContext } from "./use-styling-context";

export function buildChatRequestBody(
  requestMessage: string,
  conversationId: string | null,
  styling: ReturnType<typeof useStylingContext>,
) {
  return {
    message: requestMessage,
    conversationId,
    date: styling.date,
    location: styling.location.trim() || null,
    occasion: styling.occasion.trim() || null,
    targetFormality: styling.targetFormality ? Number(styling.targetFormality) : undefined,
    indoorOutdoor: styling.indoorOutdoor || null,
  };
}
