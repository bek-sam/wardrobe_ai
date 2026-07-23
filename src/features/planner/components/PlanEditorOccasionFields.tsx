export function PlanEditorOccasionFields({
  occasion,
  onOccasion,
  eventTitle,
  onEventTitle,
}: {
  occasion: string;
  onOccasion: (value: string) => void;
  eventTitle: string;
  onEventTitle: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <label className="form-field">
        <span>Occasion</span>
        <input
          className="text-input"
          maxLength={160}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="Office, dinner, outdoors…"
          value={occasion}
        />
      </label>
      <label className="form-field">
        <span>Event title</span>
        <input
          className="text-input"
          maxLength={200}
          onChange={(event) => onEventTitle(event.target.value)}
          placeholder="Client lunch"
          value={eventTitle}
        />
      </label>
    </div>
  );
}
