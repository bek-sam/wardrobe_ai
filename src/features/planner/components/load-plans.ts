import { isObject } from "@/lib/api/normalize";
import { requestJson } from "@/lib/api/request";

import { normalizePlan } from "./normalize-plan";
import type { PlanView } from "./planner.types";

export async function loadPlans(query: URLSearchParams, signal: AbortSignal): Promise<PlanView[]> {
  const planResult = await requestJson<unknown>(`/api/plans?${query}`, { signal });
  const rawPlans = isObject(planResult) && Array.isArray(planResult.plans) ? planResult.plans : [];
  const basePlans = rawPlans.map(normalizePlan).filter((plan): plan is PlanView => Boolean(plan));
  return Promise.all(
    basePlans.map(async (plan) => {
      try {
        const detail = await requestJson<unknown>(`/api/plans/${encodeURIComponent(plan.id)}`, {
          signal,
        });
        return normalizePlan(detail) ?? plan;
      } catch {
        return plan;
      }
    }),
  );
}
