import { describe, expect, it } from "vitest";

import { buildRecordedPlans } from "@/lib/ai/agents/orchestrator/handlers/support";
import type { PlanDayView } from "@/lib/ai/agents/orchestrator";

const itemId = "b8e1c0a4-2f6d-4a1b-8c3e-9d5f7a2b4c60";
const planDay: PlanDayView = {
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
};

describe("recorded plan serialization", () => {
  it("stores only replayable owned-item and published-weather fields", () => {
    const [recorded] = buildRecordedPlans([planDay]);
    expect(Object.keys(recorded ?? {}).sort()).toEqual([
      "confidence",
      "date",
      "explanation",
      "items",
      "name",
      "occasion",
      "weather_context",
    ]);
    expect(recorded?.items).toEqual([{ item_id: itemId, role: "layer", sort_order: 0 }]);
    expect(recorded?.weather_context).toEqual(planDay.weather);
    for (const forbidden of ["latitude", "longitude", "prompt", "reasoning", "apiKey"] as const) {
      expect(JSON.stringify(recorded)).not.toContain(forbidden);
    }
  });

  it("preserves order and normalizes absent weather", () => {
    const second = { ...planDay, date: "2026-07-29", title: "Shirt and chinos", weather: null };
    const recorded = buildRecordedPlans([planDay, second]);
    expect(recorded.map((entry) => entry.date)).toEqual(["2026-07-28", "2026-07-29"]);
    expect(recorded[1]?.weather_context).toEqual({});
  });
});
