import { isObject, nullableString } from "./history-primitives";
import { previewStatuses, uuidPattern } from "./history-constants.data";

// Never carries a signed URL: signed URLs are short-lived and this result can
// be persisted (stylist chat history), so only a stable candidateId + status
// + tags survive sanitization. A viewer fetches a fresh signed URL on demand
// from GET /api/outfit-candidates/[candidateId]/preview.
export function publicPreview(value: unknown) {
  if (!isObject(value)) return null;
  const candidateId = nullableString(value.candidateId, 40);
  if (!candidateId || !uuidPattern.test(candidateId)) return null;
  const status =
    typeof value.status === "string" && previewStatuses.has(value.status) ? value.status : "none";
  const styleTags = Array.isArray(value.styleTags)
    ? value.styleTags
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .slice(0, 5)
        .map((entry) => entry.slice(0, 40))
    : [];
  return { candidateId, status, styleTags };
}
