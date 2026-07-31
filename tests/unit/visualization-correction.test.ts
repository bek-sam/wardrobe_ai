import { describe, expect, it, vi } from "vitest";

import { generateWithQaGate } from "@/jobs/generate-outfit-visualizations";
import type {
  GeneratedVisualizationImage,
  OutfitVisualizationProvider,
  VisualizationGarmentInput,
} from "@/lib/ai/visualization-provider";
import { VisualizationProviderError } from "@/lib/ai/visualization-provider";
import type { VisualizationAssessment } from "@/lib/visualization";

const ITEM = "11111111-1111-4111-8111-111111111111";

const GARMENT: VisualizationGarmentInput = {
  imageNumber: 2,
  itemId: ITEM,
  role: "top",
  name: "Shirt",
  colorNames: [],
  pattern: null,
  fit: null,
  silhouette: null,
  materials: [],
  cutout: Buffer.alloc(0),
};

function assessment(overrides: Partial<VisualizationAssessment> = {}): VisualizationAssessment {
  return {
    identity: { recognizableMatch: "pass", faceVisible: true },
    framing: { singlePerson: true, fullBodyVisible: true, headVisible: true, shoesVisible: true },
    anatomy: { verdict: "pass", issues: [] },
    garments: [
      {
        itemId: ITEM,
        role: "top",
        present: true,
        colorFidelity: "pass",
        patternFidelity: "pass",
        silhouetteFidelity: "pass",
        constructionFidelity: "pass",
        closureFidelity: "pass",
        distinctiveDetailFidelity: "pass",
      },
    ],
    extraGarments: [],
    verdict: "pass",
    correctionInstructions: [],
    safeSummary: "Fine.",
    ...overrides,
  };
}

type GenerateArgs = { correctionInstructions?: readonly string[] };

function provider(assessments: VisualizationAssessment[]) {
  const generate = vi.fn<(input: GenerateArgs) => Promise<GeneratedVisualizationImage>>(
    async () => ({
      bytes: Buffer.alloc(1),
      mimeType: "image/png" as const,
      width: 1024,
      height: 1536,
      sha256: "a".repeat(64),
      requestId: null,
    }),
  );
  let call = 0;
  return {
    generate,
    provider: {
      name: "fake",
      generate,
      assess: async () => assessments[Math.min(call++, assessments.length - 1)]!,
      localize: async () => ({ regions: [] }),
      assessIdentity: async () => {
        throw new Error("unused");
      },
    } as unknown as OutfitVisualizationProvider,
  };
}

const attempt = { userId: "u1", identity: Buffer.alloc(0), garments: [GARMENT] };
const CORRECTABLE = assessment({ extraGarments: ["a jacket"], verdict: "correctable" });

describe("QA-gated generation", () => {
  it("returns the first image when it passes", async () => {
    const { provider: fake, generate } = provider([assessment()]);
    const result = await generateWithQaGate(fake, attempt, 0);
    expect(result.correctionUsed).toBe(false);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("spends exactly one corrective regeneration when the first is fixable", async () => {
    const { provider: fake, generate } = provider([CORRECTABLE, assessment()]);
    const result = await generateWithQaGate(fake, attempt, 0);
    expect(result.correctionUsed).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("feeds the specific structured failures into the corrective prompt", async () => {
    const { provider: fake, generate } = provider([CORRECTABLE, assessment()]);
    await generateWithQaGate(fake, attempt, 0);
    const second = generate.mock.calls[1]?.[0];
    expect(second?.correctionInstructions?.[0]).toMatch(/added a garment/);
  });

  it("never becomes ready when the corrected image still fails", async () => {
    const { provider: fake, generate } = provider([CORRECTABLE, CORRECTABLE]);
    await expect(generateWithQaGate(fake, attempt, 0)).rejects.toBeInstanceOf(
      VisualizationProviderError,
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("does not spend a second correction when one was already used", async () => {
    const { provider: fake, generate } = provider([CORRECTABLE, assessment()]);
    await expect(generateWithQaGate(fake, attempt, 1)).rejects.toBeInstanceOf(
      VisualizationProviderError,
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("never retries a terminal identity failure", async () => {
    const terminal = assessment({
      identity: { recognizableMatch: "fail", faceVisible: true },
      verdict: "fail",
    });
    const { provider: fake, generate } = provider([terminal, assessment()]);
    await expect(generateWithQaGate(fake, attempt, 0)).rejects.toMatchObject({
      code: "qa_rejected",
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
