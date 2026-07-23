import { errorMessage } from "@/lib/api/request";

import type { Insights } from "./insights.types";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

export async function loadInsights(signal: AbortSignal): Promise<Insights> {
  const response = await fetch("/api/insights", { signal });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<Insights> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, "Wardrobe insights could not be loaded."));
  }
  return payload.data;
}
