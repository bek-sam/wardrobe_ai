import { beforeEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.fn();
const getServerEnvironmentMock = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({ responses: { parse: parseMock } }),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => getServerEnvironmentMock(),
}));

const { resolveOccasionContextWithEscalation } = await import("@/lib/ai/agents/occasion-agent");

const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("resolveOccasionContextWithEscalation", () => {
  beforeEach(() => {
    parseMock.mockReset();
    getServerEnvironmentMock.mockReset();
    getServerEnvironmentMock.mockReturnValue({});
  });

  it("never calls the model for confident deterministic matches", async () => {
    const result = await resolveOccasionContextWithEscalation("job interview downtown", USER_ID);
    expect(result.category).toBe("interview");
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("never calls the model for empty text", async () => {
    const result = await resolveOccasionContextWithEscalation(null, USER_ID);
    expect(result.category).toBe("casual");
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("falls back to the deterministic result when no model is configured", async () => {
    getServerEnvironmentMock.mockReturnValue({});
    const result = await resolveOccasionContextWithEscalation("xyz something unrelated", USER_ID);
    expect(result.category).toBe("casual");
    expect(result.confidence).toBeLessThan(0.5);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("uses the model's structured result when escalation is configured and succeeds", async () => {
    getServerEnvironmentMock.mockReturnValue({
      OPENAI_API_KEY: "sk-test",
      OPENAI_STYLIST_MODEL: "test-model",
    });
    parseMock.mockResolvedValue({
      output_parsed: {
        category: "party",
        targetFormality: 3,
        indoorOutdoor: "mixed",
        activityLevel: "moderate",
        timeOfDay: "evening",
        dressCodeConstraints: [],
        confidence: 0.85,
        unresolvedQuestions: [],
      },
    });

    const result = await resolveOccasionContextWithEscalation(
      "getting together with some people later",
      USER_ID,
    );
    expect(result.category).toBe("party");
    expect(result.confidence).toBe(0.85);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the deterministic result when the model call throws", async () => {
    getServerEnvironmentMock.mockReturnValue({
      OPENAI_API_KEY: "sk-test",
      OPENAI_STYLIST_MODEL: "test-model",
    });
    parseMock.mockRejectedValue(new Error("provider unavailable"));

    const result = await resolveOccasionContextWithEscalation("xyz something unrelated", USER_ID);
    expect(result.category).toBe("casual");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("falls back to the deterministic result when the model returns nothing parseable", async () => {
    getServerEnvironmentMock.mockReturnValue({
      OPENAI_API_KEY: "sk-test",
      OPENAI_STYLIST_MODEL: "test-model",
    });
    parseMock.mockResolvedValue({ output_parsed: null });

    const result = await resolveOccasionContextWithEscalation("xyz something unrelated", USER_ID);
    expect(result.category).toBe("casual");
    expect(result.confidence).toBeLessThan(0.5);
  });
});
