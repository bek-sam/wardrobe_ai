import { beforeEach, describe, expect, it, vi } from "vitest";

const environment: Record<string, unknown> = {};
const classifyWardrobeIntentWithModel = vi.fn(async () => null as { intent: string } | null);

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => environment,
}));
vi.mock("@/lib/ai/agents/orchestrator/intent/model-classifier", () => ({
  canClassifyWardrobeIntentWithModel: () =>
    Boolean(environment.OPENAI_API_KEY && environment.OPENAI_STYLIST_MODEL),
  classifyWardrobeIntentWithModel,
}));

const { resolveChatIntentWithQuota } = await import("@/app/api/stylist/chat/resolve-chat-intent");

type RpcCall = { name: string; args: Record<string, unknown> };

/** Records every usage RPC so a test can assert exactly what was charged. */
function usageClientStub() {
  const calls: RpcCall[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return {
      data: { allowed: true, limit: 10, remaining: 9, reset_at: "2026-07-28T00:00:00Z" },
      error: null,
    };
  });
  return {
    calls,
    client: { rpc } as never,
    /** Daily generation units charged, by feature. */
    dailyFeatures: () =>
      calls
        .filter((call) => call.name === "check_and_increment_usage")
        .map((call) => call.args.p_feature),
    rollingBuckets: () =>
      calls.filter((call) => call.name === "consume_rate_limit").map((call) => call.args.p_bucket),
  };
}

const baseInput = { userId: "00000000-0000-4000-8000-000000000001", date: "2026-07-27" };

function resetEnvironment(overrides: Record<string, unknown> = {}) {
  for (const key of Object.keys(environment)) delete environment[key];
  Object.assign(
    environment,
    {
      WARDROBE_QUERY_RATE_LIMIT_PER_MINUTE: 20,
      INTENT_CLASSIFICATION_RATE_LIMIT_PER_MINUTE: 10,
      STYLIST_RATE_LIMIT_PER_MINUTE: 5,
      PLANNER_RATE_LIMIT_PER_MINUTE: 2,
      DAILY_STYLIST_LIMIT: 40,
      DAILY_PLANNER_LIMIT: 10,
    },
    overrides,
  );
}

describe("stylist chat quota at the authenticated boundary", () => {
  beforeEach(() => {
    classifyWardrobeIntentWithModel.mockClear();
    classifyWardrobeIntentWithModel.mockResolvedValue(null);
    resetEnvironment();
  });

  it("charges a wardrobe lookup no daily generation quota", async () => {
    const usage = usageClientStub();
    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "Do I own a blue blazer?",
    });

    expect(resolved.intent).toBe("item_question");
    expect(usage.dailyFeatures()).toEqual([]);
    expect(usage.rollingBuckets()).toEqual(["wardrobe_query"]);
  });

  it("charges an insight request no daily generation quota", async () => {
    const usage = usageClientStub();
    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "What have I not worn this year?",
    });

    expect(resolved.intent).toBe("insight");
    expect(usage.dailyFeatures()).toEqual([]);
    expect(usage.rollingBuckets()).toEqual(["wardrobe_query"]);
  });

  it("charges an outfit request exactly one stylist unit", async () => {
    const usage = usageClientStub();
    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "What should I wear to dinner tonight?",
    });

    expect(resolved.intent).toBe("outfit_request");
    expect(usage.dailyFeatures()).toEqual(["stylist_generation"]);
    expect(usage.rollingBuckets()).toEqual(["stylist_generation"]);
  });

  it("charges planning exactly one planner unit and never a stylist unit", async () => {
    const usage = usageClientStub();
    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "Plan my outfits for next week",
    });

    expect(resolved.intent).toBe("planning");
    expect(usage.dailyFeatures()).toEqual(["planner_generation"]);
    expect(usage.dailyFeatures()).not.toContain("stylist_generation");
    expect(usage.rollingBuckets()).not.toContain("stylist_generation");
  });

  it("charges packing exactly one planner unit and never a stylist unit", async () => {
    const usage = usageClientStub();
    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "Pack me for 3 days in chicago",
    });

    expect(resolved.intent).toBe("packing");
    expect(usage.dailyFeatures()).toEqual(["planner_generation"]);
    expect(usage.dailyFeatures()).not.toContain("stylist_generation");
    expect(usage.rollingBuckets()).not.toContain("stylist_generation");
  });

  it("rate-limits one classifier call, then bills only the final route", async () => {
    resetEnvironment({ OPENAI_API_KEY: "test-key", OPENAI_STYLIST_MODEL: "test-model" });
    classifyWardrobeIntentWithModel.mockResolvedValue({
      intent: "insight",
      confidence: 0.9,
    } as never);
    const usage = usageClientStub();

    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "hmm, something nice",
    });

    expect(classifyWardrobeIntentWithModel).toHaveBeenCalledTimes(1);
    expect(resolved.intent).toBe("insight");
    // Classification takes its own rolling bucket before the model call, then
    // the resolved route takes its own -- and no daily unit is charged for
    // routing itself.
    expect(usage.rollingBuckets()).toEqual(["intent_classification", "wardrobe_query"]);
    expect(usage.dailyFeatures()).toEqual([]);
  });

  it("never escalates a confident request to the classifier model", async () => {
    resetEnvironment({ OPENAI_API_KEY: "test-key", OPENAI_STYLIST_MODEL: "test-model" });
    const usage = usageClientStub();

    await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "Do I own a blue blazer?",
    });

    expect(classifyWardrobeIntentWithModel).not.toHaveBeenCalled();
    expect(usage.rollingBuckets()).not.toContain("intent_classification");
  });

  it("keeps routing deterministic, and free of a classifier charge, with OpenAI unset", async () => {
    const usage = usageClientStub();

    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "hmm, something nice",
    });

    expect(classifyWardrobeIntentWithModel).not.toHaveBeenCalled();
    expect(usage.rollingBuckets()).not.toContain("intent_classification");
    expect(resolved.intent).toBe("outfit_request");
  });

  it("bills the deterministic fallback route when the classifier call fails", async () => {
    resetEnvironment({ OPENAI_API_KEY: "test-key", OPENAI_STYLIST_MODEL: "test-model" });
    classifyWardrobeIntentWithModel.mockResolvedValue(null);
    const usage = usageClientStub();

    const resolved = await resolveChatIntentWithQuota(usage.client, {
      ...baseInput,
      request: "hmm, something nice",
    });

    expect(classifyWardrobeIntentWithModel).toHaveBeenCalledTimes(1);
    expect(resolved.intent).toBe("outfit_request");
    expect(usage.rollingBuckets()).toEqual(["intent_classification", "stylist_generation"]);
    expect(usage.dailyFeatures()).toEqual(["stylist_generation"]);
  });
});
