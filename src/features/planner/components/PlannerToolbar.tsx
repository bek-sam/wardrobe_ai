import { CaretLeft, CaretRight } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import { formatWeekRange } from "./planner-dates";
import type { PlannerToolbarProps } from "./planner.types";

export function PlannerToolbar({ anchor, today, dates, loading, profile, onShift, onToday }: PlannerToolbarProps) {
  return (
    <div className="planner-toolbar">
      <button
        disabled={!anchor || loading}
        aria-label="Previous seven days"
        onClick={() => onShift(-7)}
        type="button"
      >
        <CaretLeft size={17} />
      </button>
      <div>
        <strong>{formatWeekRange(dates)}</strong>
        <span>
          {profile.locationName ?? "Home location not set"} ·{" "}
          {profile.temperatureUnit === "fahrenheit" ? "Fahrenheit" : "Celsius"}
        </span>
      </div>
      <button
        disabled={!anchor || loading}
        aria-label="Next seven days"
        onClick={() => onShift(7)}
        type="button"
      >
        <CaretRight size={17} />
      </button>
      <Button disabled={!today || loading} onClick={onToday} variant="ghost">
        Today
      </Button>
    </div>
  );
}
