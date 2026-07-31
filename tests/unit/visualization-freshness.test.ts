import { describe, expect, it } from "vitest";

import { computeVisualizationSourceHash } from "@/lib/visualization/freshness";
import type { VisualizationFreshnessInput } from "@/lib/visualization";

function baseInput(): VisualizationFreshnessInput {
  return {
    items: [
      {
        itemId: "11111111-1111-4111-8111-111111111111",
        role: "top",
        sortOrder: 0,
        cutoutSha256: "a".repeat(64),
      },
      {
        itemId: "22222222-2222-4222-8222-222222222222",
        role: "bottom",
        sortOrder: 1,
        cutoutSha256: "b".repeat(64),
      },
    ],
    identitySha256: "c".repeat(64),
    promptVersion: "outfit-visualization@v2",
    capabilityVersion: "auto_fidelity@1",
    modelKey: "configured-image-model",
    outputSize: "1024x1536",
    outputQuality: "high",
    qaVersion: "visualization-qa@v1",
    localizationVersion: "garment-hotspots@v1",
  };
}

describe("visualization freshness hash", () => {
  it("is stable for semantically identical ordered inputs", () => {
    expect(computeVisualizationSourceHash(baseInput())).toBe(
      computeVisualizationSourceHash(baseInput()),
    );
  });

  it("ignores the order the items happen to arrive in", () => {
    const reversed = { ...baseInput(), items: [...baseInput().items].reverse() };
    expect(computeVisualizationSourceHash(reversed)).toBe(
      computeVisualizationSourceHash(baseInput()),
    );
  });

  // Every one of these can change the rendered image, so every one must
  // invalidate an existing visualization rather than silently reusing it.
  const mutations: [string, (input: VisualizationFreshnessInput) => VisualizationFreshnessInput][] =
    [
      ["identity hash", (input) => ({ ...input, identitySha256: "d".repeat(64) })],
      [
        "a cutout's content hash",
        (input) => ({
          ...input,
          items: [{ ...input.items[0]!, cutoutSha256: "e".repeat(64) }, input.items[1]!],
        }),
      ],
      [
        "item order",
        (input) => ({
          ...input,
          items: [
            { ...input.items[0]!, sortOrder: 1 },
            { ...input.items[1]!, sortOrder: 0 },
          ],
        }),
      ],
      [
        "a role",
        (input) => ({ ...input, items: [{ ...input.items[0]!, role: "layer" }, input.items[1]!] }),
      ],
      ["prompt version", (input) => ({ ...input, promptVersion: "outfit-visualization@v3" })],
      ["provider capability version", (input) => ({ ...input, capabilityVersion: "other@1" })],
      ["configured model key", (input) => ({ ...input, modelKey: "different-model" })],
      ["output size", (input) => ({ ...input, outputSize: "1024x1024" })],
      ["output quality", (input) => ({ ...input, outputQuality: "medium" })],
      ["QA schema version", (input) => ({ ...input, qaVersion: "visualization-qa@v2" })],
      ["localization version", (input) => ({ ...input, localizationVersion: "hotspots@v2" })],
    ];

  it.each(mutations)("changes when %s changes", (_label, mutate) => {
    expect(computeVisualizationSourceHash(mutate(baseInput()))).not.toBe(
      computeVisualizationSourceHash(baseInput()),
    );
  });
});
