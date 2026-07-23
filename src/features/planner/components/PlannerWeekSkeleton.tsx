export function PlannerWeekSkeleton() {
  return (
    <section
      className="week-grid planner-week-loading"
      aria-busy="true"
      aria-label="Loading outfit plans"
    >
      {Array.from({ length: 7 }, (_, index) => (
        <article className="day-card" key={index}>
          <span className="planner-skeleton planner-skeleton--date" />
          <span className="planner-skeleton planner-skeleton--occasion" />
          <span className="planner-skeleton planner-skeleton--look" />
        </article>
      ))}
    </section>
  );
}
