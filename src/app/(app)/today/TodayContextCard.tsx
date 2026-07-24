import { CalendarBlank } from "@phosphor-icons/react/ssr";

import { Card } from "@/components/ui/Card";

export function TodayContextCard() {
  return (
    <Card className="context-card" as="section">
      <div className="context-card__icon">
        <CalendarBlank size={22} weight="light" />
      </div>
      <div>
        <p className="eyebrow">Today’s context</p>
        <h2>What are you dressing for?</h2>
        <p>Add an occasion so the recommendation can match your day.</p>
      </div>
      <div className="context-card__choices">
        <button type="button">Work</button>
        <button type="button">Casual day</button>
        <button type="button">Dinner</button>
        <button type="button">Add context</button>
      </div>
    </Card>
  );
}
