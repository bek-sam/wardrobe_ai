export function ManualOutfitNotesField({
  explanation,
  onExplanation,
  favorite,
  onFavorite,
  saving,
}: {
  explanation: string;
  onExplanation: (value: string) => void;
  favorite: boolean;
  onFavorite: (value: boolean) => void;
  saving: boolean;
}) {
  return (
    <>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="manual-outfit-explanation">Notes</label>
          <span>Optional</span>
        </div>
        <textarea
          className="textarea-input"
          disabled={saving}
          id="manual-outfit-explanation"
          maxLength={1_500}
          onChange={(event) => onExplanation(event.target.value)}
          placeholder="Why this combination works, styling notes, or a dress-code reminder"
          rows={3}
          value={explanation}
        />
      </div>
      <label className="check-row">
        <input
          checked={favorite}
          disabled={saving}
          onChange={(event) => onFavorite(event.target.checked)}
          type="checkbox"
        />
        Save as a favorite outfit
      </label>
    </>
  );
}
