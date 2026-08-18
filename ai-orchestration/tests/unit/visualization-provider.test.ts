import { describe, expect, it } from "vitest";

import {
  buildImageEditRequest,
  IMAGE_CAPABILITY_PROFILE_TABLE,
  normalizeVisualizationProviderError,
  VisualizationProviderError,
  type GenerateVisualizationInput,
  type VisualizationGarmentInput,
} from "@/lib/ai/visualization-provider";

function garment(imageNumber: number): VisualizationGarmentInput {
  return {
    imageNumber,
    itemId: `${imageNumber}`.repeat(8),
    role: "top",
    name: "Shirt",
    colorNames: ["navy"],
    pattern: null,
    fit: null,
    silhouette: null,
    materials: [],
    cutout: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  };
}

function input(count: number): GenerateVisualizationInput {
  return {
    userId: "user-1",
    identity: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    garments: Array.from({ length: count }, (_unused, index) => garment(index + 2)),
  };
}

describe("capability-aware request builder", () => {
  it("omits input_fidelity for a profile whose model applies it automatically", async () => {
    const request = await buildImageEditRequest(
      input(2),
      IMAGE_CAPABILITY_PROFILE_TABLE.auto_fidelity,
      "configured-model",
      "prompt",
    );
    expect(request).not.toHaveProperty("input_fidelity");
  });

  it("sends input_fidelity only for a profile whose model requires it", async () => {
    const request = await buildImageEditRequest(
      input(2),
      IMAGE_CAPABILITY_PROFILE_TABLE.explicit_high_fidelity,
      "configured-model",
      "prompt",
    );
    expect(request).toHaveProperty("input_fidelity", "high");
  });

  it("always uses a portrait size for full-body try-on", async () => {
    const request = await buildImageEditRequest(
      input(2),
      IMAGE_CAPABILITY_PROFILE_TABLE.auto_fidelity,
      "configured-model",
      "prompt",
    );
    expect(request.size).toBe("1024x1536");
  });

  it("puts the identity reference first and garments in imageNumber order", async () => {
    const request = await buildImageEditRequest(
      { ...input(3), garments: [garment(4), garment(2), garment(3)] },
      IMAGE_CAPABILITY_PROFILE_TABLE.auto_fidelity,
      "configured-model",
      "prompt",
    );
    expect(request.image).toHaveLength(4);
    const names = request.image.map((file) => (file as { name: string }).name);
    expect(names).toEqual([
      "identity-reference.png",
      "garment-2.png",
      "garment-3.png",
      "garment-4.png",
    ]);
  });

  it("blocks rather than silently dropping a garment past the provider limit", async () => {
    const capability = { ...IMAGE_CAPABILITY_PROFILE_TABLE.auto_fidelity, maxImageInputs: 3 };
    await expect(
      buildImageEditRequest(input(4), capability, "configured-model", "prompt"),
    ).rejects.toBeInstanceOf(VisualizationProviderError);
  });
});

describe("provider error normalization", () => {
  const cases: [unknown, string, boolean][] = [
    [{ status: 401 }, "authentication", false],
    [{ status: 429 }, "rate_limited", true],
    [{ status: 503 }, "provider_transient", true],
    [new Error("request timed out"), "timeout", true],
    [new Error("blocked by our safety system"), "moderation_blocked", false],
    [new Error("Unknown parameter: input_fidelity"), "unsupported_capability", false],
    [new Error("invalid image supplied"), "input_validation", false],
    [new Error("something else entirely"), "unknown", false],
  ];

  it.each(cases)("maps %o to a bounded code", (thrown, code, retryable) => {
    const normalized = normalizeVisualizationProviderError(thrown);
    expect(normalized.code).toBe(code);
    expect(normalized.retryable).toBe(retryable);
  });

  it("never carries the original error or its request body forward", () => {
    const leaky = Object.assign(new Error("boom"), {
      status: 400,
      request: { prompt: "SECRET PROMPT", image: "SECRET BYTES" },
    });
    const serialized = JSON.stringify({
      ...normalizeVisualizationProviderError(leaky),
      message: normalizeVisualizationProviderError(leaky).message,
    });
    expect(serialized).not.toContain("SECRET");
  });

  it("keeps a provider request id when one is available", () => {
    const normalized = normalizeVisualizationProviderError(
      Object.assign(new Error("boom"), { status: 500, requestID: "req_123" }),
    );
    expect(normalized.requestId).toBe("req_123");
  });
});
