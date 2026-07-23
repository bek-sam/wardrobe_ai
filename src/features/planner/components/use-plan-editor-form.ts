import { useState } from "react";
import type { FormEvent } from "react";

import { requestJson } from "@/lib/api/request";

import { buildPlanPayload } from "./build-plan-payload";
import { usePlanDelete } from "./use-plan-delete";
import type { PlanFormState, PlanView } from "./planner.types";

export function usePlanEditorForm(
  date: string,
  plan: PlanView | null,
  onSaved: () => void,
  onDeleted: () => void,
) {
  const [form, setForm] = useState<PlanFormState>({
    plannedDate: plan?.plannedDate ?? date,
    outfitId: plan?.outfitId ?? "",
    startTime: plan?.startTime?.slice(0, 5) ?? "",
    occasion: plan?.occasion ?? "",
    locationName: plan?.locationName ?? "",
    eventTitle: plan?.eventTitle ?? "",
    status: plan?.status === "skipped" ? "skipped" : "planned",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deletePlan = usePlanDelete(plan, onDeleted, setSaving, setError);

  function setField<Key extends keyof PlanFormState>(key: Key, value: PlanFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requestJson<unknown>(
        plan ? `/api/plans/${encodeURIComponent(plan.id)}` : "/api/plans",
        {
          method: plan ? "PATCH" : "POST",
          body: JSON.stringify(buildPlanPayload(form, plan)),
        },
      );
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return { form, setField, saving, error, submit, deletePlan };
}
