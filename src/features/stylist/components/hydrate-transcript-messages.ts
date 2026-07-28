import { normalizeStylistAnswer } from "./normalize-stylist-answer";
import { recommendationFromStoredMessage } from "./normalize-stylist-recommendation";
import type { ChatMessage } from "./stylist.types";

export function hydrateTranscriptMessages(
  messages: ChatMessage[],
  conversationId: string,
): ChatMessage[] {
  return messages.map((entry) => {
    const storedRecommendation = recommendationFromStoredMessage(entry, conversationId);
    if (storedRecommendation) {
      return {
        ...entry,
        note: storedRecommendation.warnings[0] ?? storedRecommendation.followUpQuestion ?? null,
      };
    }
    const storedAnswer = normalizeStylistAnswer(entry.structuredResult);
    // Restores the saved/unsaved state of a plan too, so reloading a
    // conversation never re-offers an action the user already completed.
    return storedAnswer
      ? { ...entry, details: storedAnswer.details, plan: storedAnswer.plan }
      : entry;
  });
}

export function findLatestRecommendation(messages: ChatMessage[], conversationId: string) {
  return (
    [...messages]
      .reverse()
      .map((entry) => recommendationFromStoredMessage(entry, conversationId))
      .find((entry) => entry !== null) ?? null
  );
}
