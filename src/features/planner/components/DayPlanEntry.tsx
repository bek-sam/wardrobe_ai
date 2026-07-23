import { CalendarBlank, PencilSimple } from "@phosphor-icons/react";

import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

import { artworkCategory } from "./artwork-category";
import type { PlanView } from "./planner.types";

export function DayPlanEntry({ plan, onEdit }: { plan: PlanView; onEdit: () => void }) {
  return (
    <section className={`day-plan day-plan--${plan.status}`}>
      {plan.items.length ? (
        <div className="day-plan__pieces">
          {plan.items.map((item) => (
            <GarmentArtwork
              category={artworkCategory(item.role)}
              color={item.primaryColor ?? "#9c968b"}
              accent={item.secondaryColor ?? undefined}
              compact
              key={item.id}
            />
          ))}
        </div>
      ) : (
        <span className="day-plan__no-look">
          <CalendarBlank size={18} /> Occasion only
        </span>
      )}
      <strong>{plan.outfitName ?? plan.eventTitle ?? plan.occasion ?? "Planned day"}</strong>
      <small>
        {plan.startTime ? `${plan.startTime.slice(0, 5)} · ` : ""}
        {plan.status}
      </small>
      <button onClick={onEdit} type="button">
        <PencilSimple size={13} /> Edit
      </button>
    </section>
  );
}
