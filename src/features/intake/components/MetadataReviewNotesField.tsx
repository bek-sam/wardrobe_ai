import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewNotesField({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <label className="form-field">
      <span>Notes</span>
      <textarea
        className="textarea-input"
        maxLength={2000}
        onChange={(event) => setField("notes", event.target.value)}
        value={form.notes}
      />
    </label>
  );
}
