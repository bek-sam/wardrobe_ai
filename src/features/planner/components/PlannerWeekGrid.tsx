import { DayCard } from "./DayCard";
import type { PlanView, ProfileView, WeatherView } from "./planner.types";

export function PlannerWeekGrid({
  dates,
  today,
  plansByDate,
  forecast,
  profile,
  onEdit,
}: {
  dates: string[];
  today: string;
  plansByDate: Map<string, PlanView[]>;
  forecast: Map<string, WeatherView>;
  profile: ProfileView;
  onEdit: (date: string, plan: PlanView | null) => void;
}) {
  return (
    <section className="week-grid" aria-label="Seven-day outfit plan">
      {dates.map((date) => (
        <DayCard
          date={date}
          dayPlans={plansByDate.get(date) ?? []}
          isToday={date === today}
          key={date}
          onEdit={(plan) => onEdit(date, plan)}
          temperatureUnit={profile.temperatureUnit}
          weather={forecast.get(date) ?? null}
        />
      ))}
    </section>
  );
}
