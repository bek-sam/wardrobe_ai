import { requestJson } from "@/lib/api/request";
import type { Dispatch, SetStateAction } from "react";

import type { PlanView } from "./planner.types";

export function usePlanDelete(
  plan: PlanView | null,
  onDeleted: () => void,
  setSaving: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string | null>>,
) {
  return async function deletePlan() {
    if (!plan || !window.confirm(`Delete the plan for ${plan.plannedDate}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson<unknown>(`/api/plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be deleted.");
    } finally {
      setSaving(false);
    }
  };
}
