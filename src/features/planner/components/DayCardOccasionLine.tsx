import { Badge } from "@/components/ui/Badge";

import type { PlanView } from "./planner.types";

export function DayCardOccasionLine({
  dayPlans,
  isToday,
}: {
  dayPlans: PlanView[];
  isToday: boolean;
}) {
  return (
    <div className="day-card__occasion">
      <span>
        {dayPlans
          .map((plan) => plan.eventTitle ?? plan.occasion)
          .filter(Boolean)
          .join(" · ") || "Open day"}
      </span>
      {isToday ? <Badge tone="rust">Today</Badge> : null}
    </div>
  );
}
