import type { PlanFormState, PlanView } from "./planner.types";

export function buildPlanPayload(form: PlanFormState, plan: PlanView | null) {
  const common = {
    outfit_id: form.outfitId || null,
    planned_date: form.plannedDate,
    start_time: form.startTime || null,
    occasion: form.occasion.trim() || null,
    location_name: form.locationName.trim() || null,
    event_title: form.eventTitle.trim() || null,
  };
  return plan
    ? { ...common, ...(plan.status === "worn" ? {} : { status: form.status }) }
    : { ...common, weather_snapshot: null, status: "planned" };
}
