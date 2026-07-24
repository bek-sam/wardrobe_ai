import type { OutfitCuratorResult } from "@/lib/ai/schemas/outfit-curator";

export function validateCuratorDecisions(
  result: OutfitCuratorResult,
  candidateIds: ReadonlySet<string>,
) {
  const ids = result.decisions.map((decision) => decision.candidateId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("The outfit curator returned a duplicate candidate decision.");
  }
  const invalidIds = ids.filter((id) => !candidateIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error("The outfit curator returned a decision outside the authenticated shortlist.");
  }
  const returnedIds = new Set(ids);
  const missingIds = [...candidateIds].filter((id) => !returnedIds.has(id));
  if (missingIds.length > 0) {
    throw new Error("The outfit curator did not return a decision for every candidate.");
  }
}
