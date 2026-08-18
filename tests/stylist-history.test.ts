import { describe, expect, it } from "vitest";

import { sanitizeStylistStructuredResult } from "@/features/stylist";
import {
  stylistConversationListQuerySchema,
  stylistMessageListQuerySchema,
} from "@/features/stylist";

const topId = "d7af47d5-31f2-45d0-a253-940d8b243123";
const bottomId = "623267bc-2be9-4d30-91a7-17fb6baa658e";
const generationId = "5985ac32-bb23-4c1a-99bf-a966b106b07b";

describe("stylist conversation history", () => {
  it("returns only the structured fields rendered by the stylist UI", () => {
    const result = sanitizeStylistStructuredResult({
      generationId,
      intent: "planning",
      outfit: {
        title: "Weather-ready work look",
        items: [
          { item_id: topId, role: "top", sort_order: 0 },
          { item_id: bottomId, role: "bottom", sort_order: 1 },
        ],
        explanation: "A concise, owned-item recommendation.",
        warnings: ["Carry an umbrella."],
        confidence: 0.86,
        missing_category: null,
        follow_up_question: null,
        resolvedItems: [
          {
            id: topId,
            user_id: "private-owner-id",
            materials: { secret: "database row must not be exposed" },
          },
        ],
        combinationKey: "internal-combination-key",
      },
      weather: {
        date: "2026-07-22",
        location: {
          name: "Chicago",
          latitude: 41.88,
          longitude: -87.63,
        },
        snapshot: {
          minimumTemperatureC: 18,
          maximumTemperatureC: 24,
          precipitationProbability: 65,
          internalProviderPayload: "drop me",
        },
        constraints: {
          tags: ["rain_protection", "rain_safe_shoes"],
          scoreTrace: [0.1, 0.4],
        },
      },
      excludedItemCount: 3,
      toolTrace: [{ hidden: true }],
      hiddenReasoning: "never return this",
    });

    expect(result).toMatchObject({
      generationId,
      intent: "planning",
      outfit: {
        title: "Weather-ready work look",
        items: [
          { item_id: topId, role: "top", sort_order: 0 },
          { item_id: bottomId, role: "bottom", sort_order: 1 },
        ],
      },
      weather: {
        date: "2026-07-22",
        location: { name: "Chicago" },
        snapshot: {
          minimumTemperatureC: 18,
          maximumTemperatureC: 24,
          precipitationProbability: 65,
        },
        constraints: { tags: ["rain_protection", "rain_safe_shoes"] },
      },
      excludedItemCount: 3,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-owner-id");
    expect(serialized).not.toContain("resolvedItems");
    expect(serialized).not.toContain("combinationKey");
    expect(serialized).not.toContain("latitude");
    expect(serialized).not.toContain("toolTrace");
    expect(serialized).not.toContain("hiddenReasoning");
  });

  it("nulls malformed or incomplete structured results", () => {
    expect(sanitizeStylistStructuredResult({ hiddenReasoning: "no outfit" })).toBeNull();
    expect(
      sanitizeStylistStructuredResult({
        outfit: {
          title: "Invented",
          items: [{ item_id: topId, role: "top" }],
          explanation: "Missing a complete outfit foundation.",
          warnings: [],
          confidence: 0.5,
          missing_category: null,
          follow_up_question: null,
        },
      }),
    ).toBeNull();
  });

  it("strictly caps list and transcript pagination", () => {
    expect(stylistConversationListQuerySchema.parse({})).toEqual({ limit: 12, offset: 0 });
    expect(stylistMessageListQuerySchema.parse({})).toEqual({ limit: 100, offset: 0 });
    expect(stylistConversationListQuerySchema.safeParse({ limit: "26" }).success).toBe(false);
    expect(stylistMessageListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(stylistMessageListQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    expect(stylistConversationListQuerySchema.safeParse({ unexpected: "value" }).success).toBe(
      false,
    );
  });
});
