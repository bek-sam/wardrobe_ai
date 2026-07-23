import { CalendarBlank } from "@phosphor-icons/react";

export function PlannerEmptyState() {
  return (
    <section className="empty-state planner-empty-state">
      <span className="empty-state__icon">
        <CalendarBlank size={24} />
      </span>
      <h2>No plans in these seven days</h2>
      <p>
        Add an occasion manually, or let the planner build saved looks from owned, available pieces.
      </p>
    </section>
  );
}
