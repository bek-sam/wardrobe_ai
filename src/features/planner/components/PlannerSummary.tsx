import { Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function PlannerSummary({
  lookCount,
  planCount,
  rainyDays,
  openDays,
  aiConfigured,
  onFillOpenDays,
}: {
  lookCount: number;
  planCount: number;
  rainyDays: number;
  openDays: number;
  aiConfigured: boolean;
  onFillOpenDays: () => void;
}) {
  return (
    <section className="planner-summary">
      <div>
        <span className="planner-summary__icon">
          <Sparkle size={22} weight="light" />
        </span>
        <div>
          <h2>Week at a glance</h2>
          <p>
            {lookCount} saved {lookCount === 1 ? "look" : "looks"} across this seven-day window.
          </p>
        </div>
      </div>
      <ul>
        <li>
          <span />
          {rainyDays} rainy {rainyDays === 1 ? "day" : "days"}
        </li>
        <li>
          <span />
          {planCount} {planCount === 1 ? "plan" : "plans"}
        </li>
        <li>
          <span />
          {openDays} open {openDays === 1 ? "day" : "days"}
        </li>
      </ul>
      <Button disabled={!aiConfigured || !openDays} onClick={onFillOpenDays} variant="secondary">
        Fill open days
      </Button>
    </section>
  );
}
