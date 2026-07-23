import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewTagFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
      <label className="form-field">
        <span>Visible text</span>
        <input
          className="text-input"
          onChange={(event) => setField("visibleText", event.target.value)}
          placeholder="Comma separated"
          value={form.visibleText}
        />
      </label>
      <label className="form-field">
        <span>Seasons</span>
        <input
          className="text-input"
          onChange={(event) => setField("seasonTags", event.target.value)}
          placeholder="spring, fall"
          value={form.seasonTags}
        />
      </label>
      <label className="form-field">
        <span>Occasions</span>
        <input
          className="text-input"
          onChange={(event) => setField("occasionTags", event.target.value)}
          placeholder="work, casual"
          value={form.occasionTags}
        />
      </label>
    </>
  );
}
