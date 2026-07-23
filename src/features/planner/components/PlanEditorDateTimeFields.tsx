export function PlanEditorDateTimeFields({
  plannedDate,
  onPlannedDate,
  startTime,
  onStartTime,
}: {
  plannedDate: string;
  onPlannedDate: (value: string) => void;
  startTime: string;
  onStartTime: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <label className="form-field">
        <span>Date</span>
        <input
          className="text-input"
          onChange={(event) => onPlannedDate(event.target.value)}
          required
          type="date"
          value={plannedDate}
        />
      </label>
      <label className="form-field">
        <span>Start time</span>
        <input
          className="text-input"
          onChange={(event) => onStartTime(event.target.value)}
          type="time"
          value={startTime}
        />
      </label>
    </div>
  );
}
