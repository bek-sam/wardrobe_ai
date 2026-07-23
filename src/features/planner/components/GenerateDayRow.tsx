import { parseIsoDate } from "./planner-dates";
import type { GenerateDay } from "./planner.types";

export function GenerateDayRow({
  day,
  onToggleSelected,
  onOccasion,
}: {
  day: GenerateDay;
  onToggleSelected: (selected: boolean) => void;
  onOccasion: (occasion: string) => void;
}) {
  return (
    <div className={day.selected ? "is-selected" : ""}>
      <label className="check-row">
        <input
          checked={day.selected}
          onChange={(event) => onToggleSelected(event.target.checked)}
          type="checkbox"
        />
        <strong>
          {new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }).format(parseIsoDate(day.date))}
        </strong>
      </label>
      <input
        aria-label={`Occasion for ${day.date}`}
        className="text-input"
        disabled={!day.selected}
        maxLength={120}
        onChange={(event) => onOccasion(event.target.value)}
        placeholder="Occasion (optional)"
        value={day.occasion}
      />
    </div>
  );
}
