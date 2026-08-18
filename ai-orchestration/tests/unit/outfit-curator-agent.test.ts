import { beforeEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.fn();
const requireEnvironmentMock = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({ responses: { parse: parseMock } }),
}));

vi.mock("@/lib/env/server", () => ({
  requireEnvironment: (...keys: string[]) => requireEnvironmentMock(...keys),
}));

const { runOutfitCuratorAgent, MAX_CURATOR_INPUT_CANDIDATES } =
  await import("@/lib/ai/agents/outfit-curator-agent");

const USER_ID = "00000000-0000-4000-8000-000000000001";
const CANDIDATE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CANDIDATE_B = "aaaaaaaa-0000-4000-8000-000000000002";

function makeCandidate(candidateId: string) {
  return {
    candidateId,
    occasionCategory: "casual" as const,
    formalityLevel: 2,
    warmthLevel: 2,
    totalScore: 0.7,
    colorHarmony: 0.7,
    layeringQuality: 0.7,
    occasionFormality: 0.7,
    preferenceMatch: 0.7,
    variety: 0.7,
    containsNewItem: false,
    items: [],
    styleKnowledge: {
      colorScheme: "monochrome" as const,
      patternMixCompatible: true,
      silhouetteBalanced: true,
      materialTier: "smart_casual" as const,
      formalityConsistent: true,
      matchedArchetypes: [],
      weatherGuidance: "Most single-layer outfits are comfortable.",
    },
  };
}

function baseInput() {
  return {
    userId: USER_ID,
    candidates: [makeCandidate(CANDIDATE_A), makeCandidate(CANDIDATE_B)],
    userPreferences: {
      styleKeywords: [],
      styleArchetypes: [],
      favoriteColors: [],
      avoidedColors: [],
    },
    knowledgeVersion: "test-version",
  };
}

describe("runOutfitCuratorAgent", () => {
  beforeEach(() => {
    parseMock.mockReset();
    requireEnvironmentMock.mockReset();
    requireEnvironmentMock.mockReturnValue({ OPENAI_CURATOR_MODEL: "test-curator-model" });
  });

  it("throws when no candidates are supplied", async () => {
    await expect(runOutfitCuratorAgent({ ...baseInput(), candidates: [] })).rejects.toThrow(
      /no candidates/i,
    );
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("throws when the candidate shortlist exceeds the configured limit", async () => {
    const tooMany = Array.from({ length: MAX_CURATOR_INPUT_CANDIDATES + 1 }, (_, index) =>
      makeCandidate(`aaaaaaaa-0000-4000-8000-0000000${String(index).padStart(5, "0")}`),
    );
    await expect(runOutfitCuratorAgent({ ...baseInput(), candidates: tooMany })).rejects.toThrow(
      /exceeds the configured limit/i,
    );
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("throws when the model returns a duplicate candidate decision", async () => {
    parseMock.mockResolvedValue({
      id: "resp_1",
      usage: {},
      output_parsed: {
        decisions: [
          {
            candidateId: CANDIDATE_A,
            decision: "select",
            aestheticTags: [],
            occasionCategory: "casual",
            rankAmongNewItemOutfits: null,
            confidence: 0.8,
            reasoning: "Clean and coherent.",
            rejectionReason: null,
          },
          {
            candidateId: CANDIDATE_A,
            decision: "reject",
            aestheticTags: [],
            occasionCategory: "casual",
            rankAmongNewItemOutfits: null,
            confidence: 0.5,
            reasoning: "Duplicate.",
            rejectionReason: "Duplicate decision.",
          },
        ],
        summary: "Reviewed two outfits.",
      },
    });

    await expect(runOutfitCuratorAgent(baseInput())).rejects.toThrow(/duplicate/i);
  });

  it("throws when the model returns a decision outside the authenticated shortlist", async () => {
    parseMock.mockResolvedValue({
      id: "resp_1",
      usage: {},
      output_parsed: {
        decisions: [
          {
            candidateId: "ffffffff-0000-4000-8000-000000000099",
            decision: "select",
            aestheticTags: [],
            occasionCategory: "casual",
            rankAmongNewItemOutfits: null,
            confidence: 0.8,
            reasoning: "Looks good.",
            rejectionReason: null,
          },
        ],
        summary: "Reviewed one outfit.",
      },
    });

    await expect(runOutfitCuratorAgent(baseInput())).rejects.toThrow(
      /outside the authenticated shortlist/i,
    );
  });

  it("throws when the model omits a decision for a supplied candidate", async () => {
    parseMock.mockResolvedValue({
      id: "resp_1",
      usage: {},
      output_parsed: {
        decisions: [
          {
            candidateId: CANDIDATE_A,
            decision: "select",
            aestheticTags: [],
            occasionCategory: "casual",
            rankAmongNewItemOutfits: null,
            confidence: 0.8,
            reasoning: "Clean and coherent.",
            rejectionReason: null,
          },
        ],
        summary: "Reviewed one outfit.",
      },
    });

    await expect(runOutfitCuratorAgent(baseInput())).rejects.toThrow(
      /did not return a decision for every candidate/i,
    );
  });

  it("returns the parsed result when every decision is within the supplied candidate set", async () => {
    parseMock.mockResolvedValue({
      id: "resp_1",
      usage: { total_tokens: 42 },
      output_parsed: {
        decisions: [
          {
            candidateId: CANDIDATE_A,
            decision: "select",
            aestheticTags: ["minimalist"],
            occasionCategory: "casual",
            rankAmongNewItemOutfits: 1,
            confidence: 0.9,
            reasoning: "Coherent palette and silhouette.",
            rejectionReason: null,
          },
          {
            candidateId: CANDIDATE_B,
            decision: "reject",
            aestheticTags: [],
            occasionCategory: "casual",
            rankAmongNewItemOutfits: null,
            confidence: 0.4,
            reasoning: "Clashing colors.",
            rejectionReason: "color_conflict",
          },
        ],
        summary: "Reviewed two outfits.",
      },
    });

    const result = await runOutfitCuratorAgent(baseInput());
    expect(result.result.decisions).toHaveLength(2);
    expect(result.model).toBe("test-curator-model");
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the model returns no parseable output", async () => {
    parseMock.mockResolvedValue({ output_parsed: null });
    await expect(runOutfitCuratorAgent(baseInput())).rejects.toThrow(/did not return a valid/i);
  });
});
