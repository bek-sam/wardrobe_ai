import { useState } from "react";

import type { GenerateDay, PlanView } from "./planner.types";

export function useGenerateDays(dates: string[], plans: PlanView[]) {
  const [days, setDays] = useState<GenerateDay[]>(() =>
    dates.map((date) => {
      const dayPlans = plans.filter((plan) => plan.plannedDate === date);
      const hasOutfit = dayPlans.some((plan) => plan.outfitId && plan.status !== "skipped");
      return {
        date,
        selected: !hasOutfit,
        occasion: dayPlans.find((plan) => plan.occasion)?.occasion ?? "",
      };
    }),
  );

  function toggleSelected(index: number, selected: boolean) {
    setDays((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, selected } : entry)),
    );
  }

  function setOccasion(index: number, occasion: string) {
    setDays((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, occasion } : entry)),
    );
  }

  return { days, toggleSelected, setOccasion };
}
