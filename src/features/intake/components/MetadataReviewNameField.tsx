import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewNameField({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <label className="form-field">
      <span>Name</span>
      <input
        className="text-input"
        maxLength={160}
        onChange={(event) => setField("name", event.target.value)}
        required
        value={form.name}
      />
    </label>
  );
}
