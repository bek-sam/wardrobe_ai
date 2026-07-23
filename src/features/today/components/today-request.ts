import { isObject } from "@/lib/api/normalize";

import { TodayRequestError } from "./today-request-error";

type ApiEnvelope<T> = { data: T } | { error: { code?: string; message?: string } };

function errorMessage(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    const code = payload && "error" in payload ? (payload.error.code ?? null) : null;
    throw new TodayRequestError(
      response.status,
      code,
      errorMessage(payload, `The request failed (${response.status}).`),
    );
  }
  return payload.data;
}
