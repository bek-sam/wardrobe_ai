import { GenerateDayRow } from "./GenerateDayRow";
import type { GenerateDay } from "./planner.types";

export function GenerateDayList({
  days,
  onToggleSelected,
  onOccasion,
}: {
  days: GenerateDay[];
  onToggleSelected: (index: number, selected: boolean) => void;
  onOccasion: (index: number, occasion: string) => void;
}) {
  return (
    <div className="generate-day-list">
      {days.map((day, index) => (
        <GenerateDayRow
          day={day}
          key={day.date}
          onOccasion={(occasion) => onOccasion(index, occasion)}
          onToggleSelected={(selected) => onToggleSelected(index, selected)}
        />
      ))}
    </div>
  );
}
