import { useState } from "react";

import { requestJson } from "@/lib/api/request";

type SavePlanResponse = { generationId: string; saved: boolean };

/**
 * Owns one plan answer's save state. The request body carries only the
 * generation id -- the plan days themselves are replayed server-side -- and
 * the RPC behind it is idempotent, so a double click cannot save twice.
 */
export function useSavePlan(generationId: string, initiallySaved: boolean) {
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saved || saving) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson<SavePlanResponse>("/api/plans/generated", {
        method: "POST",
        body: JSON.stringify({ generationId }),
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return { saved, saving, error, save };
}
