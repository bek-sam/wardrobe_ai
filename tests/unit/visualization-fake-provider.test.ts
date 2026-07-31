import { describe, expect, it } from "vitest";

import {
  createFakeVisualizationProvider,
  IMAGE_CAPABILITY_PROFILE_TABLE,
  VisualizationProviderError,
  type GenerateVisualizationInput,
  type VisualizationGarmentInput,
} from "@/lib/ai/visualization-provider";
import { evaluateQaGate } from "@/lib/visualization";

const CAPABILITY = IMAGE_CAPABILITY_PROFILE_TABLE.auto_fidelity;

function garment(imageNumber: number, role: VisualizationGarmentInput["role"]) {
  return {
    imageNumber,
    itemId: `${imageNumber}${"1".repeat(7)}-1111-4111-8111-111111111111`.slice(0, 36),
    role,
    name: "Piece",
    colorNames: ["navy"],
    pattern: null,
    fit: null,
    silhouette: null,
    materials: [],
    cutout: Buffer.alloc(0),
  };
}

function input(): GenerateVisualizationInput {
  return {
    userId: "user-1",
    identity: Buffer.alloc(0),
    garments: [garment(2, "top"), garment(3, "bottom")],
  };
}

/**
 * The fake provider is what lets the whole pipeline — including the QA gate and
 * the storage path — run in CI with no OpenAI key and no paid call, so its own
 * behaviour is worth pinning down.
 */
describe("fake visualization provider", () => {
  it("produces a real, decodable portrait PNG", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "ready");
    const image = await provider.generate(input());

    expect(image.mimeType).toBe("image/png");
    expect(image.height).toBeGreaterThan(image.width);
    // A real PNG signature, not a stub buffer.
    expect(image.bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(image.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic, so a test can assert on the content hash", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "ready");
    const [first, second] = [await provider.generate(input()), await provider.generate(input())];
    expect(first.sha256).toBe(second.sha256);
  });

  it("passes the real QA gate on the ready outcome", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "ready");
    const assessment = await provider.assess({ ...input(), image: Buffer.alloc(0) });
    expect(evaluateQaGate(assessment).verdict).toBe("pass");
  });

  it("fails the real QA gate terminally on the qa_fail outcome", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "qa_fail");
    const assessment = await provider.assess({ ...input(), image: Buffer.alloc(0) });
    expect(evaluateQaGate(assessment).verdict).toBe("fail");
  });

  it("fails once then succeeds on transient_once, exercising retry-then-success", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "transient_once");
    await expect(provider.generate(input())).rejects.toMatchObject({
      code: "provider_transient",
      retryable: true,
    });
    await expect(provider.generate(input())).resolves.toMatchObject({ mimeType: "image/png" });
  });

  it("raises a terminal moderation error on the moderation outcome", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "moderation");
    const error = await provider.generate(input()).catch((cause) => cause);
    expect(error).toBeInstanceOf(VisualizationProviderError);
    expect(error.code).toBe("moderation_blocked");
    expect(error.retryable).toBe(false);
  });

  it("localizes exactly the supplied garments and nothing else", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "ready");
    const { regions } = await provider.localize({ ...input(), image: Buffer.alloc(0) });
    expect(regions.map((region) => region.role)).toEqual(["top", "bottom"]);
  });

  it("never reports a body inference from the identity check", async () => {
    const provider = createFakeVisualizationProvider(CAPABILITY, "ready");
    const assessment = await provider.assessIdentity({ userId: "u1", image: Buffer.alloc(0) });
    expect(assessment.verdict).toBe("pass");
    expect(Object.keys(assessment)).not.toContain("bodyType");
  });
});
