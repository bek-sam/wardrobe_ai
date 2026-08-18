import { describe, expect, it, vi } from "vitest";

import { applyAnswerResult } from "@/features/stylist/components/stylist-model";
import { normalizeStylistAnswer } from "@/features/stylist/components/stylist-model";
import type { ChatMessage } from "@/features/stylist/components/stylist-model";

const conversationId = "5985ac32-bb23-4c1a-99bf-a966b106b07b";

const packingResult = {
  conversationId,
  kind: "packing",
  intent: "packing",
  answer: "Pack 2 owned pieces for Chicago to cover 2 days.",
  destination: "Chicago",
  packingList: [
    { itemId: "a", name: "Navy blazer", role: "layer", category: "outerwear", dayCount: 2 },
    { itemId: "b", name: "Grey jeans", role: "bottom", category: "bottoms", dayCount: 1 },
  ],
};

function sessionStub() {
  const messages: ChatMessage[] = [];
  return {
    messages,
    setConversationId: vi.fn(),
    setMessages: vi.fn((update: (current: ChatMessage[]) => ChatMessage[]) => {
      messages.push(...update([]));
    }),
  };
}

describe("non-outfit stylist answers in the transcript", () => {
  it("summarises each answer kind into detail lines", () => {
    expect(normalizeStylistAnswer(packingResult)?.details).toEqual([
      "Navy blazer — layer · 2 days",
      "Grey jeans — bottom · 1 day",
    ]);
    expect(
      normalizeStylistAnswer({
        kind: "item_question",
        answer: "Yes — you own 1 item.",
        matches: [
          {
            itemId: "a",
            name: "Navy wool blazer",
            category: "outerwear",
            colorNames: ["navy"],
            availability: "laundry",
          },
        ],
      })?.details,
    ).toEqual(["Navy wool blazer — outerwear · navy · laundry"]);
  });

  it("ignores outfit results so the recommendation panel keeps them", () => {
    expect(normalizeStylistAnswer({ kind: "outfit", answer: "A look." })).toBeNull();
    expect(normalizeStylistAnswer({ answer: "No kind field." })).toBeNull();
  });

  it("appends the answer to the transcript and adopts the conversation id", () => {
    const session = sessionStub();
    const applied = applyAnswerResult(
      packingResult,
      session as unknown as Parameters<typeof applyAnswerResult>[1],
    );
    expect(applied).toBe(true);
    expect(session.setConversationId).toHaveBeenCalledWith(conversationId);
    expect(session.messages[0]).toMatchObject({
      role: "assistant",
      content: packingResult.answer,
    });
    expect(session.messages[0]?.details).toHaveLength(2);
  });

  it("declines outfit payloads so the outfit path still runs", () => {
    const session = sessionStub();
    const applied = applyAnswerResult(
      { conversationId, kind: "outfit", answer: "A look." },
      session as unknown as Parameters<typeof applyAnswerResult>[1],
    );
    expect(applied).toBe(false);
    expect(session.setMessages).not.toHaveBeenCalled();
  });
});
