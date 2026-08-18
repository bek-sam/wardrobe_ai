import { describe, expect, it } from "vitest";

import {
  buildPromotedImportAssetPath,
  planConfirmedImportAssetPromotions,
} from "@/lib/imports/asset-promotion";

const userId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const buckets = {
  originals: "wardrobe-originals",
  items: "wardrobe-items",
  generated: "wardrobe-generated",
};
const pngMetadata = {
  mime_type: "image/png" as const,
  width: 800,
  height: 1_000,
  file_size: 50_000,
};

describe("confirmed import asset promotion", () => {
  it("builds stable item-scoped paths from identifiers and MIME type", () => {
    const input = {
      userId,
      itemId,
      candidateId,
      kind: "cutout" as const,
      contentType: "image/jpeg" as const,
    };

    expect(buildPromotedImportAssetPath(input)).toBe(
      `${userId}/${itemId}/cutout/${candidateId}.jpg`,
    );
    expect(buildPromotedImportAssetPath(input)).toBe(buildPromotedImportAssetPath(input));
  });

  it("moves crops to the item bucket and generated assets to stable generated paths", () => {
    const plans = planConfirmedImportAssetPromotions({
      userId,
      buckets,
      candidates: [
        {
          candidateId,
          itemId,
          crop: {
            path: `${userId}/job/candidates/${candidateId}/crop.png`,
            metadata: pngMetadata,
          },
          cutout: {
            path: `${userId}/job/candidates/${candidateId}/cutout-2.png`,
            metadata: pngMetadata,
          },
          modeled: {
            path: `${userId}/job/candidates/${candidateId}/modeled.png`,
            metadata: pngMetadata,
          },
        },
      ],
    });

    expect(plans).toHaveLength(3);
    expect(plans.map(({ kind, source, destination }) => ({ kind, source, destination }))).toEqual([
      {
        kind: "crop",
        source: {
          bucket: "wardrobe-originals",
          path: `${userId}/job/candidates/${candidateId}/crop.png`,
        },
        destination: {
          bucket: "wardrobe-items",
          path: `${userId}/${itemId}/crop/${candidateId}.png`,
        },
      },
      {
        kind: "cutout",
        source: {
          bucket: "wardrobe-generated",
          path: `${userId}/job/candidates/${candidateId}/cutout-2.png`,
        },
        destination: {
          bucket: "wardrobe-generated",
          path: `${userId}/${itemId}/cutout/${candidateId}.png`,
        },
      },
      {
        kind: "modeled",
        source: {
          bucket: "wardrobe-generated",
          path: `${userId}/job/candidates/${candidateId}/modeled.png`,
        },
        destination: {
          bucket: "wardrobe-generated",
          path: `${userId}/${itemId}/modeled/${candidateId}.png`,
        },
      },
    ]);
  });

  it("does not require an optional crop or modeled asset", () => {
    const plans = planConfirmedImportAssetPromotions({
      userId,
      buckets,
      candidates: [
        {
          candidateId,
          itemId,
          crop: null,
          cutout: {
            path: `${userId}/job/candidates/${candidateId}/cutout.png`,
            metadata: pngMetadata,
          },
          modeled: null,
        },
      ],
    });

    expect(plans.map((plan) => plan.kind)).toEqual(["cutout"]);
  });

  it("rejects job assets outside the authenticated user's prefix", () => {
    expect(() =>
      planConfirmedImportAssetPromotions({
        userId,
        buckets,
        candidates: [
          {
            candidateId,
            itemId,
            crop: null,
            cutout: {
              path: `99999999-9999-4999-8999-999999999999/job/cutout.png`,
              metadata: pngMetadata,
            },
            modeled: null,
          },
        ],
      }),
    ).toThrow(/does not belong/);
  });
});
