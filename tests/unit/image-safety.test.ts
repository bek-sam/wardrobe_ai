import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { calculatePaddedCrop, normalizeBoundingBox } from "@/lib/image/crop";
import { processChromaBackground } from "@/lib/image/cleanup";
import { inspectTransparentCutout, validateAndNormalizeImage } from "@/lib/image/validation";
import { assertOwnedStoragePath } from "@/lib/storage/private-images";

import { USER_ID } from "./fixtures";

describe("private image safety", () => {
  it("clamps model bounding boxes and padded crops to the decoded canvas", () => {
    expect(normalizeBoundingBox({ x: -50, y: 990, width: 2_000, height: 400 })).toEqual({
      x: 0,
      y: 990,
      width: 1_000,
      height: 10,
    });
    const crop = calculatePaddedCrop(800, 600, { x: 900, y: 900, width: 100, height: 100 });
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(800);
    expect(crop.top + crop.height).toBeLessThanOrEqual(600);
  });

  it("validates decoded bytes and normalizes supported images to metadata-free PNG", async () => {
    await expect(validateAndNormalizeImage(Buffer.from("not an image"))).rejects.toThrow();
    const jpeg = await sharp({
      create: { width: 100, height: 80, channels: 3, background: "#123456" },
    })
      .jpeg()
      .toBuffer();
    const normalized = await validateAndNormalizeImage(jpeg);
    expect(normalized).toMatchObject({ mimeType: "image/png", width: 100, height: 80 });
    expect((await sharp(normalized.bytes).metadata()).format).toBe("png");
  });

  it("removes a generated chroma background and keeps the garment centered", async () => {
    const garment = await sharp({
      create: { width: 128, height: 128, channels: 3, background: "#00ff00" },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 48, height: 80, channels: 3, background: "#9b2c2c" },
          })
            .png()
            .toBuffer(),
          left: 40,
          top: 24,
        },
      ])
      .png()
      .toBuffer();

    const result = await processChromaBackground(garment, "#00ff00");
    const diagnostics = await inspectTransparentCutout(result.bytes);
    expect(result.diagnostics.accepted).toBe(true);
    expect(diagnostics).toMatchObject({ width: 1024, height: 1024, touchesCanvasEdge: false });
    expect(diagnostics.visiblePixelRatio).toBeGreaterThan(0);
  });

  it("rejects paths outside the authenticated user's private prefix", () => {
    expect(() => assertOwnedStoragePath(`${USER_ID}/jobs/photo.png`, USER_ID)).not.toThrow();
    expect(() => assertOwnedStoragePath(`another-user/photo.png`, USER_ID)).toThrow();
    expect(() => assertOwnedStoragePath(`${USER_ID}/../other/photo.png`, USER_ID)).toThrow();
    expect(() => assertOwnedStoragePath(`${USER_ID}\\other\\photo.png`, USER_ID)).toThrow();
  });
});
