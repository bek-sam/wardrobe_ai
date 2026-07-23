import { requestJson } from "@/lib/api/request";

import type { ResearchRun } from "./item-detail.types";

export async function startResearch(
  itemId: string,
  researchClue: string,
  reload: () => Promise<void>,
) {
  const run = await requestJson<ResearchRun>(`/api/items/${itemId}/research`, {
    method: "POST",
    body: JSON.stringify({ userClue: researchClue || null }),
  });
  await requestJson(`/api/items/${itemId}/research/${run.id}/process`, { method: "POST" });
  await reload();
}
