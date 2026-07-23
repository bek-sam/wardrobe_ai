export function ManualOutfitNameOccasionFields({
  name,
  onName,
  occasion,
  onOccasion,
  saving,
}: {
  name: string;
  onName: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
  saving: boolean;
}) {
  return (
    <div className="form-grid form-grid--two">
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="manual-outfit-name">Outfit name</label>
          <span>Required</span>
        </div>
        <input
          autoFocus
          className="text-input"
          disabled={saving}
          id="manual-outfit-name"
          maxLength={160}
          onChange={(event) => onName(event.target.value)}
          placeholder="Weekend layers"
          required
          value={name}
        />
      </div>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="manual-outfit-occasion">Occasion</label>
          <span>Optional</span>
        </div>
        <input
          className="text-input"
          disabled={saving}
          id="manual-outfit-occasion"
          maxLength={160}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="Work, dinner, travel…"
          value={occasion}
        />
      </div>
    </div>
  );
}
