import { Plus } from "@phosphor-icons/react";

import { DayCardHeader } from "./DayCardHeader";
import { DayCardOccasionLine } from "./DayCardOccasionLine";
import { DayPlanEntry } from "./DayPlanEntry";
import { parseIsoDate } from "./planner-dates";
import type { PlanView, WeatherView } from "./planner.types";

export function DayCard({
  date,
  isToday,
  dayPlans,
  weather,
  temperatureUnit,
  onEdit,
}: {
  date: string;
  isToday: boolean;
  dayPlans: PlanView[];
  weather: WeatherView | null;
  temperatureUnit: "celsius" | "fahrenheit";
  onEdit: (plan: PlanView | null) => void;
}) {
  const parsed = parseIsoDate(date);
  return (
    <article className={`day-card${isToday ? " is-today" : ""}`}>
      <DayCardHeader
        dayOfMonth={parsed.getDate()}
        temperatureUnit={temperatureUnit}
        weather={weather}
        weekday={new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed)}
      />
      <DayCardOccasionLine dayPlans={dayPlans} isToday={isToday} />
      {dayPlans.length ? (
        <div className="day-card__plans">
          {dayPlans.map((plan) => (
            <DayPlanEntry key={plan.id} onEdit={() => onEdit(plan)} plan={plan} />
          ))}
          <button className="day-card__add-plan" onClick={() => onEdit(null)} type="button">
            <Plus size={14} /> Add another
          </button>
        </div>
      ) : (
        <button className="day-card__empty" onClick={() => onEdit(null)} type="button">
          <Plus size={20} /> <span>Plan a look or occasion</span>
        </button>
      )}
    </article>
  );
}
