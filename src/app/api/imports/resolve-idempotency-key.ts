import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/response";

export function resolveIdempotencyKey(headerValue: string | null, bodyKey: string | undefined) {
  const idempotencyKey = headerValue ?? bodyKey ?? randomUUID();
  if (idempotencyKey.length > 200) {
    throw new ApiError(400, "invalid_idempotency_key", "The idempotency key is too long.");
  }
  return idempotencyKey;
}
