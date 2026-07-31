import { describe, expect, it } from "vitest";

import { buildOutfitVisualizationPrompt } from "@/lib/ai/prompts/outfit-visualization";
import type { VisualizationGarmentInput } from "@/lib/ai/visualization-provider";

function garment(
  imageNumber: number,
  role: VisualizationGarmentInput["role"],
  name: string,
): VisualizationGarmentInput {
  return {
    imageNumber,
    itemId: `${imageNumber}`.repeat(8),
    role,
    name,
    colorNames: ["navy"],
    pattern: "solid",
    fit: "regular",
    silhouette: "straight",
    materials: ["cotton"],
    cutout: Buffer.alloc(0),
  };
}

describe("outfit visualization prompt", () => {
  it("maps every garment to an explicit image number and role", () => {
    const prompt = buildOutfitVisualizationPrompt([
      garment(2, "top", "Oxford shirt"),
      garment(3, "bottom", "Chino trouser"),
      garment(4, "shoes", "Loafer"),
    ]);
    expect(prompt).toContain("Image 2 is the top");
    expect(prompt).toContain("Image 3 is the bottom");
    expect(prompt).toContain("Image 4 is the shoes");
  });

  it("orders the listing by image number regardless of input order", () => {
    const prompt = buildOutfitVisualizationPrompt([
      garment(4, "shoes", "Loafer"),
      garment(2, "top", "Oxford shirt"),
    ]);
    expect(prompt.indexOf("Image 2")).toBeLessThan(prompt.indexOf("Image 4"));
  });

  it("handles a one-piece dress outfit", () => {
    const prompt = buildOutfitVisualizationPrompt([garment(2, "dress", "Midi dress")]);
    expect(prompt).toContain("Image 2 is the dress");
  });

  it("handles a layered outfit", () => {
    const prompt = buildOutfitVisualizationPrompt([
      garment(2, "top", "Tee"),
      garment(3, "bottom", "Jeans"),
      garment(4, "layer", "Trench coat"),
      garment(5, "accessory", "Scarf"),
    ]);
    expect(prompt).toContain("Image 4 is the outer layer");
    expect(prompt).toContain("Image 5 is the accessory");
  });

  it("states that image 1 is the identity reference and supplies no clothing", () => {
    const prompt = buildOutfitVisualizationPrompt([garment(2, "top", "Tee")]);
    expect(prompt).toContain("Image 1 is the identity reference");
    expect(prompt).toContain("It supplies no clothing");
  });

  it("requires portrait full-body framing and forbids invented garments", () => {
    const prompt = buildOutfitVisualizationPrompt([garment(2, "top", "Tee")]);
    expect(prompt).toContain("full body, head through shoes, in portrait framing");
    expect(prompt).toMatch(/Do not add any jacket, coat, bag, belt, scarf, hat, jewelry/);
  });

  it("says this is a visualization rather than a fit prediction", () => {
    const prompt = buildOutfitVisualizationPrompt([garment(2, "top", "Tee")]);
    expect(prompt).toContain("style visualization, not a fit simulation");
  });

  it("makes no body-shape claim or inference request", () => {
    const prompt = buildOutfitVisualizationPrompt([garment(2, "top", "Tee")]).toLowerCase();
    for (const forbidden of ["body type", "flatter", "slimming", "figure", "physique"]) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  it("appends only the specific structured failures on a corrective attempt", () => {
    const prompt = buildOutfitVisualizationPrompt(
      [garment(2, "top", "Tee")],
      ["The top is missing from the image."],
    );
    expect(prompt).toContain("A previous attempt was rejected");
    expect(prompt).toContain("- The top is missing from the image.");
  });

  it("omits the correction block entirely on a first attempt", () => {
    expect(buildOutfitVisualizationPrompt([garment(2, "top", "Tee")])).not.toContain(
      "A previous attempt was rejected",
    );
  });
});
