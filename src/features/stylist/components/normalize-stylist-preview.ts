import { isObject, safeString } from "@/lib/api/normalize";

import { safeStrings } from "./stylist-normalize-primitives";
import { previewStatuses, uuidPattern } from "./stylist-constants.data";
import type { PreviewInfo } from "./stylist.types";

export function normalizePreview(value: unknown): PreviewInfo | null {
  if (!isObject(value)) return null;
  const candidateId = safeString(value.candidateId);
  if (!uuidPattern.test(candidateId)) return null;
  const status =
    typeof value.status === "string" && previewStatuses.has(value.status)
      ? (value.status as PreviewInfo["status"])
      : "none";
  return { candidateId, status, styleTags: safeStrings(value.styleTags, 5) };
}
