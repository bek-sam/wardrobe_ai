import { beforeEach, describe, expect, it, vi } from "vitest";

const environment: Record<string, unknown> = {};
vi.mock("@/lib/env/server", () => ({ getServerEnvironment: () => environment }));

type IntentHandler = (
  input: Record<string, unknown>,
  resolved: Record<string, unknown>,
) => Promise<{ kind: string }>;

const answerOutfitRequest = vi.fn<IntentHandler>(async () => ({ kind: "outfit" }));
const answerPlanningRequest = vi.fn<IntentHandler>(async () => ({ kind: "plan" }));
const answerPackingRequest = vi.fn<IntentHandler>(async () => ({ kind: "packing" }));
const answerInsightRequest = vi.fn<IntentHandler>(async () => ({ kind: "insight" }));
const answerItemQuestion = vi.fn<IntentHandler>(async () => ({ kind: "item_question" }));
const resolveWardrobeIntent = vi.fn(async () => ({ intent: "outfit_request", confidence: 0.9 }));

vi.mock("@/lib/ai/agents/orchestrator/handlers/outfit", () => ({ answerOutfitRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/planning", () => ({ answerPlanningRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/packing", () => ({ answerPackingRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/insight", () => ({ answerInsightRequest }));
vi.mock("@/lib/ai/agents/orchestrator/handlers/item-question", () => ({ answerItemQuestion }));
vi.mock("@/lib/ai/agents/orchestrator/intent", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveWardrobeIntent,
}));

const { requirePlannerModel, requireStylistModel } =
  await import("@/lib/ai/agents/orchestrator/require-model");
const { runWardrobeOrchestrator } = await import("@/lib/ai/agents/orchestrator/run");
const { hasGenerationCapability, isDeterministicOnly } =
  await import("@/features/stylist/capabilities");

const baseInput = {
  userId: "00000000-0000-4000-8000-000000000001",
  date: "2026-07-27",
  request: "anything",
  location: null,
  occasion: null,
};

function setEnvironment(overrides: Record<string, unknown>) {
  for (const key of Object.keys(environment)) delete environment[key];
  Object.assign(environment, overrides);
}

describe("model-backed routes fail closed", () => {
  beforeEach(() => setEnvironment({}));

  it("raises a typed 503 for outfit generation when the stylist model is unset", () => {
    expect(() => requireStylistModel()).toThrowError(
      expect.objectContaining({ status: 503, code: "stylist_model_unavailable" }),
    );
  });

  it("raises a typed 503 for planning when the planner model is unset", () => {
    expect(() => requirePlannerModel()).toThrowError(
      expect.objectContaining({ status: 503, code: "planner_model_unavailable" }),
    );
  });

  it("still fails when the key is present but the model id is not", () => {
    setEnvironment({ OPENAI_API_KEY: "test-key" });
    expect(() => requireStylistModel()).toThrowError(
      expect.objectContaining({ code: "stylist_model_unavailable" }),
    );
    expect(() => requirePlannerModel()).toThrowError(
      expect.objectContaining({ code: "planner_model_unavailable" }),
    );
  });

  it("tells the user which routes still work rather than only what is broken", () => {
    try {
      requireStylistModel();
      expect.unreachable("requireStylistModel should have thrown");
    } catch (error) {
      expect((error as Error).message).toMatch(/lookups and insights still work/i);
    }
  });

  it("returns the configured environment once both variables are present", () => {
    setEnvironment({
      OPENAI_API_KEY: "test-key",
      OPENAI_STYLIST_MODEL: "stylist-model",
      OPENAI_PLANNER_MODEL: "planner-model",
    });
    expect(requireStylistModel().OPENAI_STYLIST_MODEL).toBe("stylist-model");
    expect(requirePlannerModel().OPENAI_PLANNER_MODEL).toBe("planner-model");
  });
});

describe("stylist workspace capabilities", () => {
  const base = {
    chatAvailable: true,
    outfitGenerationAvailable: false,
    planGenerationAvailable: false,
  };

  it("treats a chat-only deployment as deterministic-only", () => {
    expect(hasGenerationCapability(base)).toBe(false);
    expect(isDeterministicOnly(base)).toBe(true);
  });

  it("reports a generation capability when either model is configured", () => {
    expect(hasGenerationCapability({ ...base, outfitGenerationAvailable: true })).toBe(true);
    expect(hasGenerationCapability({ ...base, planGenerationAvailable: true })).toBe(true);
    expect(isDeterministicOnly({ ...base, planGenerationAvailable: true })).toBe(false);
  });

  it("is not deterministic-only when chat itself is unavailable", () => {
    expect(isDeterministicOnly({ ...base, chatAvailable: false })).toBe(false);
  });
});

describe("intent resolved at the boundary is not re-classified", () => {
  beforeEach(() => {
    resolveWardrobeIntent.mockClear();
    answerInsightRequest.mockClear();
    answerOutfitRequest.mockClear();
  });

  it("routes on the supplied intent without classifying again", async () => {
    const resolved = { intent: "insight", confidence: 0.91, insightFocus: "unworn" };

    expect(await runWardrobeOrchestrator(baseInput, resolved as never)).toMatchObject({
      kind: "insight",
    });
    expect(resolveWardrobeIntent).not.toHaveBeenCalled();
    expect(answerInsightRequest).toHaveBeenCalledTimes(1);
    // The handler receives the very object the boundary billed against.
    expect(answerInsightRequest.mock.calls[0]?.[1]).toBe(resolved);
  });

  it("classifies only when no resolved intent was supplied", async () => {
    await runWardrobeOrchestrator(baseInput);
    expect(resolveWardrobeIntent).toHaveBeenCalledTimes(1);
  });
});
