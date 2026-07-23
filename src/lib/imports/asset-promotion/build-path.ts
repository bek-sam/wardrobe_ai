import { assertOwnedStoragePath } from "@/lib/storage/private-images";

import { mimeTypeExtensions } from "./mime-extensions.data";
import { requireUuid } from "./require-uuid";
import { imageMimeTypeSchema, promotableAssetKindSchema } from "./schemas";
import type { ImageMimeType, PromotableAssetKind } from "./schemas";

export function buildPromotedImportAssetPath(input: {
  userId: string;
  itemId: string;
  candidateId: string;
  kind: PromotableAssetKind;
  contentType: ImageMimeType;
}) {
  const userId = requireUuid(input.userId, "User ID");
  const itemId = requireUuid(input.itemId, "Item ID");
  const candidateId = requireUuid(input.candidateId, "Candidate ID");
  const kind = promotableAssetKindSchema.parse(input.kind);
  const contentType = imageMimeTypeSchema.parse(input.contentType);
  const extension = mimeTypeExtensions[contentType];
  const destination = `${userId}/${itemId}/${kind}/${candidateId}.${extension}`;
  assertOwnedStoragePath(destination, userId);
  return destination;
}
