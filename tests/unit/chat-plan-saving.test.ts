import { describe, expect, it, vi } from "vitest";

import { sanitizeNonOutfitAnswer } from "@/features/stylist/answers";
import { planAnswerSchema } from "@/features/stylist/answers";
import { applyAnswerResult } from "@/features/stylist/components/stylist-model";
import { hydrateTranscriptMessages } from "@/features/stylist/components/stylist-model";
import { normalizeStylistAnswer } from "@/features/stylist/components/stylist-model";
import type { ChatMessage } from "@/features/stylist/components/stylist-model";

const generationId = "3f1d6b2e-1c4a-4f38-9b53-1e0f2a7c9d10";
const conversationId = "5985ac32-bb23-4c1a-99bf-a966b106b07b";
const itemId = "b8e1c0a4-2f6d-4a1b-8c3e-9d5f7a2b4c60";

const planDay = {
  date: "2026-07-28",
  title: "Blazer and jeans",
  explanation: "Mild and dry, so one light layer is enough.",
  confidence: 0.82,
  occasion: "work",
  items: [
    { item_id: itemId, role: "layer", sort_order: 0, name: "Blue blazer", category: "outerwear" },
  ],
  weather: {
    locationName: "Berlin",
    minimumTemperatureC: 14,
    maximumTemperatureC: 23,
    precipitationProbability: 10,
    tags: ["mild"],
  },
} as const;

function planResult(overrides: Record<string, unknown> = {}) {
  return {
    conversationId,
    kind: "plan",
    intent: "planning",
    generationId,
    answer: "Here is a 1-day plan, built only from items you own.",
    startDate: "2026-07-28",
    endDate: "2026-07-28",
    dayCount: 1,
    days: [planDay],
    missingCategories: [],
    saved: false,
    ...overrides,
  };
}

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

describe("plan saved-flag sanitization", () => {
  it("accepts both boolean states", () => {
    expect(planAnswerSchema.safeParse(planResult({ saved: false })).success).toBe(true);
    expect(planAnswerSchema.safeParse(planResult({ saved: true })).success).toBe(true);
  });

  it("rejects a non-boolean saved flag rather than coercing it", () => {
    for (const saved of ["true", 1, null, undefined, {}]) {
      expect(planAnswerSchema.safeParse(planResult({ saved })).success).toBe(false);
    }
  });

  it("drops the whole stored answer server-side when the flag cannot be trusted", () => {
    // The Zod sanitizer is what persists/serves the answer: a non-boolean
    // never reaches the browser as a plan at all.
    expect(sanitizeNonOutfitAnswer(planResult({ saved: "yes" }))).toBeNull();
    expect(sanitizeNonOutfitAnswer(planResult({ saved: true }))).toMatchObject({ saved: true });
  });

  it("falls back to unsaved, never saved, if a stray flag reaches the browser", () => {
    // Defence in depth: the worst case is re-offering a save (which the RPC
    // makes idempotent), never hiding the action for an unsaved plan.
    expect(normalizeStylistAnswer(planResult({ saved: "yes" }))?.plan).toEqual({
      generationId,
      saved: false,
    });
    expect(normalizeStylistAnswer(planResult({ saved: 1 }))?.plan).toEqual({
      generationId,
      saved: false,
    });
  });
});

describe("plan action metadata", () => {
  it("exposes a save action for a valid unsaved plan", () => {
    expect(normalizeStylistAnswer(planResult())?.plan).toEqual({ generationId, saved: false });
  });

  it("reports an already-saved plan as saved", () => {
    expect(normalizeStylistAnswer(planResult({ saved: true }))?.plan).toEqual({
      generationId,
      saved: true,
    });
  });

  it("offers no action when the generation id is missing or malformed", () => {
    expect(normalizeStylistAnswer(planResult({ generationId: null }))?.plan).toBeNull();
    expect(normalizeStylistAnswer(planResult({ generationId: "not-a-uuid" }))?.plan).toBeNull();
  });

  it("offers no action for packing, insight, or item-question answers", () => {
    const packing = {
      conversationId,
      kind: "packing",
      intent: "packing",
      generationId,
      answer: "Pack 2 owned pieces for Chicago.",
      destination: "Chicago",
      packingList: [],
    };
    expect(normalizeStylistAnswer(packing)?.plan).toBeNull();
    expect(
      normalizeStylistAnswer({
        kind: "insight",
        intent: "insight",
        generationId,
        answer: "You have 3 items you have never worn.",
      })?.plan,
    ).toBeNull();
    expect(
      normalizeStylistAnswer({
        kind: "item_question",
        intent: "item_question",
        generationId,
        answer: "Yes, you own a blue blazer.",
      })?.plan,
    ).toBeNull();
  });

  it("keeps the action metadata on a live SSE message", () => {
    const session = sessionStub();
    expect(applyAnswerResult(planResult(), session as never)).toBe(true);
    expect(session.messages[0]?.plan).toEqual({ generationId, saved: false });
  });

  it("restores the action metadata when a conversation is reloaded", () => {
    const stored: ChatMessage[] = [
      {
        id: "1",
        role: "assistant",
        content: "Here is a 1-day plan.",
        time: "10:00",
        structuredResult: planResult(),
      },
    ];
    expect(hydrateTranscriptMessages(stored, conversationId)[0]?.plan).toEqual({
      generationId,
      saved: false,
    });
  });

  it("restores the saved state so a saved plan is never re-offered", () => {
    const stored: ChatMessage[] = [
      {
        id: "1",
        role: "assistant",
        content: "Here is a 1-day plan.",
        time: "10:00",
        structuredResult: planResult({ saved: true }),
      },
    ];
    expect(hydrateTranscriptMessages(stored, conversationId)[0]?.plan).toEqual({
      generationId,
      saved: true,
    });
  });
});
