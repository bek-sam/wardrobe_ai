import { CalendarBlank, Sparkle } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export function PlannerHeader({
  aiConfigured,
  canAddOccasion,
  onAddOccasion,
  canGenerate,
  onGenerate,
}: {
  aiConfigured: boolean;
  canAddOccasion: boolean;
  onAddOccasion: () => void;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  return (
    <PageHeader
      eyebrow="Seven-day view"
      title="Outfit planner"
      description="Plan around your week, the forecast, and what will actually be available."
      meta={
        <Badge tone={aiConfigured ? "sage" : "outline"}>
          {aiConfigured ? "Live plans" : "AI disabled"}
        </Badge>
      }
      actions={
        <>
          <Button disabled={!canAddOccasion} onClick={onAddOccasion} variant="secondary">
            <CalendarBlank size={16} /> Add occasion
          </Button>
          <Button disabled={!canGenerate} onClick={onGenerate}>
            <Sparkle size={16} /> Plan my week
          </Button>
        </>
      }
    />
  );
}
