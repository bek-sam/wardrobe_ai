export function ItemFormNotesField({
  notes,
  onNotes,
}: {
  notes: string;
  onNotes: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="item-notes">Notes</label>
        <span>Optional</span>
      </div>
      <textarea
        className="textarea-input"
        id="item-notes"
        maxLength={2000}
        onChange={(event) => onNotes(event.target.value)}
        placeholder="Fit, care, styling, or purchase notes"
        value={notes}
      />
    </div>
  );
}
