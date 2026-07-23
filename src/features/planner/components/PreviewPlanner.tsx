import { CalendarBlank, Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { PreviewBadge } from "@/components/ui/Badge";

import { previewDays } from "./planner-constants.data";
import { PreviewDayCard } from "./PreviewDayCard";

const previewWeekdays = ["Tue", "Wed", "Thu"];

export function PreviewPlanner() {
  return (
    <>
      <PageHeader
        eyebrow="Seven-day view"
        title="Outfit planner"
        description="Plan around your week, the forecast, and what will actually be available."
        meta={<PreviewBadge />}
        actions={
          <>
            <Button disabled variant="secondary">
              <CalendarBlank size={16} /> Add occasion
            </Button>
            <Button disabled>
              <Sparkle size={16} /> Plan my week
            </Button>
          </>
        }
      />
      <DemoNotice>
        This is an explicitly labeled planning preview because Supabase is not configured.
        Forecasts, occasions, and looks below are illustrative and are not saved.
      </DemoNotice>
      <section className="week-grid week-grid--preview" aria-label="Sample weekly outfit plan">
        {previewDays.map((day, index) => (
          <PreviewDayCard
            colors={day.colors}
            dayOfMonth={21 + index}
            key={day.date}
            occasion={day.occasion}
            weekday={previewWeekdays[index]!}
          />
        ))}
      </section>
    </>
  );
}
