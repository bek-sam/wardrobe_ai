import { errorMessage } from "@/lib/api/request";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

export async function patchJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, "Your onboarding choices could not be saved."));
  }
  return payload.data;
}
