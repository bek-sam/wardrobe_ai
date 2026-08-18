import { beforeEach, describe, expect, it, vi } from "vitest";

type IntentHandler = (
  input: Record<string, unknown>,
  resolved: Record<string, unknown>,
) => Promise<{ kind: string }>;

const answerOutfitRequest = vi.fn<IntentHandler>(async () => ({ kind: "outfit" }));
const answerPlanningRequest = vi.fn<IntentHandler>(async () => ({ kind: "plan" }));
const answerPackingRequest = vi.fn<IntentHandler>(async () => ({ kind: "packing" }));
const answerInsightRequest = vi.fn<IntentHandler>(async () => ({ kind: "insight" }));
const answerItemQuestion = vi.fn<IntentHandler>(async () => ({ kind: "item_question" }));

vi.mock("@/lib/ai/agents/orchestrator/handlers/outfit", () => ({ answerOutfitRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/planning", () => ({ answerPlanningRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/packing", () => ({ answerPackingRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/insight", () => ({ answerInsightRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/item-question", () => ({ answerItemQuestion }));
vi.mock("@/lib/env/server", () => ({ getServerEnvironment: () => ({}) }));

const { runWardrobeOrchestrator, runWardrobeOutfitRequest } =
  await import("@/lib/ai/agents/orchestrator/run");
const quickPrompts = [
  "Dress me for work tomorrow",
  "A casual rainy-day look",
  "Plan my outfits for next week",
  "Pack me for 3 days in Chicago",
  "What have I not worn this year?",
  "Do I own a blue blazer?",
];

const baseInput = {
  userId: "00000000-0000-4000-8000-000000000001",
  date: "2026-07-24",
  location: null,
  occasion: null,
};

async function route(request: string) {
  return runWardrobeOrchestrator({ ...baseInput, request });
}

describe("wardrobe orchestrator routing", () => {
  beforeEach(() => {
    for (const handler of [
      answerOutfitRequest,
      answerPlanningRequest,
      answerPackingRequest,
      answerInsightRequest,
      answerItemQuestion,
    ]) {
      handler.mockClear();
    }
  });

  it("sends an ownership question to the wardrobe lookup, not the stylist", async () => {
    expect(await route("Do I own a blue blazer?")).toMatchObject({ kind: "item_question" });
    expect(answerItemQuestion).toHaveBeenCalledTimes(1);
    expect(answerOutfitRequest).not.toHaveBeenCalled();
  });

  it("sends a wear-history question to the insights path", async () => {
    expect(await route("What have I not worn this year?")).toMatchObject({ kind: "insight" });
    expect(answerInsightRequest).toHaveBeenCalledTimes(1);
    expect(answerOutfitRequest).not.toHaveBeenCalled();
  });

  it("sends a trip request to the packing path with its destination", async () => {
    expect(await route("Pack me for Chicago next week")).toMatchObject({ kind: "packing" });
    expect(answerPackingRequest).toHaveBeenCalledTimes(1);
    expect(answerPackingRequest.mock.calls[0]?.[1]).toMatchObject({ destination: "Chicago" });
    expect(answerOutfitRequest).not.toHaveBeenCalled();
  });

  it("sends a multi-day request to the planner", async () => {
    expect(await route("Plan next week")).toMatchObject({ kind: "plan" });
    expect(answerPlanningRequest).toHaveBeenCalledTimes(1);
    expect(answerPlanningRequest.mock.calls[0]?.[1]).toMatchObject({
      range: { startDate: "2026-07-27", dayCount: 7 },
    });
  });

  it("still composes an outfit for single-day styling requests", async () => {
    expect(await route("Dress me for work tomorrow")).toMatchObject({ kind: "outfit" });
    expect(answerOutfitRequest).toHaveBeenCalledTimes(1);
    expect(answerPlanningRequest).not.toHaveBeenCalled();
  });

  it("routes every suggested quick prompt to the capability it advertises", async () => {
    const routed: string[] = [];
    for (const prompt of quickPrompts) {
      const result = await route(prompt);
      routed.push(result.kind);
    }
    expect(routed).toEqual(["outfit", "outfit", "plan", "packing", "insight", "item_question"]);
    expect(answerPackingRequest.mock.calls[0]?.[1]).toMatchObject({
      destination: "Chicago",
      range: { dayCount: 3 },
    });
  });

  it("forces the outfit path for the generate-and-save endpoint", async () => {
    await runWardrobeOutfitRequest({ ...baseInput, request: "Pack me for Chicago next week" });
    expect(answerOutfitRequest).toHaveBeenCalledTimes(1);
    expect(answerOutfitRequest.mock.calls[0]?.[1]).toMatchObject({ intent: "outfit_request" });
    expect(answerPackingRequest).not.toHaveBeenCalled();
  });
});
