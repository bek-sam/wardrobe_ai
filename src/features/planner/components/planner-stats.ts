import type { PlanView, WeatherView } from "./planner.types";

export function plansByDateMap(dates: string[], plans: PlanView[]): Map<string, PlanView[]> {
  return new Map(dates.map((date) => [date, plans.filter((plan) => plan.plannedDate === date)]));
}

export function countLooks(plans: PlanView[]): number {
  return plans.filter((plan) => plan.outfitId && plan.status === "planned").length;
}

export function countRainyDays(dates: string[], forecast: Map<string, WeatherView>): number {
  return dates.filter((date) => (forecast.get(date)?.rainProbability ?? 0) >= 35).length;
}

export function countOpenDays(dates: string[], plansByDate: Map<string, PlanView[]>): number {
  return dates.filter(
    (date) =>
      !(plansByDate.get(date) ?? []).some((plan) => plan.outfitId && plan.status !== "skipped"),
  ).length;
}
