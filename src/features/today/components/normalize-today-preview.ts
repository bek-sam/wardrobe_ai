import { isObject, safeString } from "@/lib/api/normalize";

import { safeStrings } from "./today-normalize-primitives";
import { previewStatuses, uuidPattern } from "./today-constants.data";
import type { TodayPreviewInfo } from "./today.types";

export function normalizePreview(value: unknown): TodayPreviewInfo | null {
  if (!isObject(value)) return null;
  const candidateId = safeString(value.candidateId);
  if (!uuidPattern.test(candidateId)) return null;
  const status =
    typeof value.status === "string" && previewStatuses.has(value.status)
      ? (value.status as TodayPreviewInfo["status"])
      : "none";
  return { candidateId, status, styleTags: safeStrings(value.styleTags, 5) };
}
