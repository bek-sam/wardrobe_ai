import { requestJson } from "@/lib/api/request";

import { normalizeConversationList } from "./normalize-conversation";

export async function fetchConversationList(signal: AbortSignal) {
  const raw = await requestJson<unknown>("/api/stylist/conversations?limit=12&offset=0", {
    signal,
  });
  const normalized = normalizeConversationList(raw);
  if (!normalized) throw new Error("Recent conversations returned an invalid response.");
  return normalized;
}
