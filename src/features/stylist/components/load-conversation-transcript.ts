import { requestJson } from "@/lib/api/request";

import {
  buildEligibleRecommendation,
  isRecommendationStillEligible,
} from "./check-recommendation-eligibility";
import { fetchItemDetails } from "./fetch-item-details";
import { findLatestRecommendation, hydrateTranscriptMessages } from "./hydrate-transcript-messages";
import { normalizeConversationTranscript } from "./normalize-conversation-transcript";
import type { ChatMessage, Recommendation } from "./stylist.types";

export async function loadConversationTranscript(conversationId: string, signal: AbortSignal) {
  const raw = await requestJson<unknown>(
    `/api/stylist/conversations/${encodeURIComponent(conversationId)}/messages?limit=100&offset=0`,
    { signal },
  );
  const transcript = normalizeConversationTranscript(raw, conversationId);
  if (!transcript) throw new Error("The conversation returned an invalid response.");

  const messages: ChatMessage[] = hydrateTranscriptMessages(transcript.messages, conversationId);
  const latest = findLatestRecommendation(messages, conversationId);
  const notices: string[] = [];
  if (transcript.hasEarlierMessages)
    notices.push(
      `Showing the latest ${transcript.messages.length} of ${transcript.count} messages.`,
    );

  let recommendation: Recommendation | null = null;
  if (latest) {
    const itemDetails = await fetchItemDetails(latest.items, signal);
    if (isRecommendationStillEligible(latest.items, itemDetails)) {
      recommendation = buildEligibleRecommendation(latest, itemDetails);
      if (!latest.generationId)
        notices.push(
          "This older recommendation is read-only. Continue the chat to create a securely saveable look.",
        );
    } else {
      notices.push(
        "The saved recommendation is read-only because one or more pieces are no longer active and available.",
      );
    }
  }

  return { messages, recommendation, notice: notices.join(" ") || null };
}
