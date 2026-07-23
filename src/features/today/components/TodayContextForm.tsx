import { CalendarBlank } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

import { TodayContextFormActions } from "./TodayContextFormActions";
import { TodayOccasionInput } from "./TodayOccasionInput";
import { TodayQuickOccasions } from "./TodayQuickOccasions";
import type { TodayContextFormProps } from "./today.types";

export function TodayContextForm({
  occasion,
  onOccasion,
  generating,
  coreLoading,
  itemCount,
  hasItems,
  aiConfigured,
  onSubmit,
  onBuildAndSave,
}: TodayContextFormProps) {
  const disabled = !aiConfigured || coreLoading || Boolean(generating) || !hasItems;
  return (
    <Card className="context-card" as="section">
      <div className="context-card__icon">
        <CalendarBlank size={22} weight="light" aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">Today’s context</p>
        <h2>What are you dressing for?</h2>
        <p>Choose a shortcut or describe today’s occasion in your own words.</p>
      </div>
      <form className="today-context-form" onSubmit={onSubmit}>
        <TodayQuickOccasions
          disabled={Boolean(generating)}
          occasion={occasion}
          onSelect={onOccasion}
        />
        <TodayOccasionInput
          coreLoading={coreLoading}
          disabled={Boolean(generating)}
          itemCount={itemCount}
          occasion={occasion}
          onOccasion={onOccasion}
        />
        <TodayContextFormActions
          disabled={disabled}
          generating={generating}
          onBuildAndSave={onBuildAndSave}
        />
      </form>
    </Card>
  );
}
