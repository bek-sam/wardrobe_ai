import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewDetailFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
      <label className="form-field">
        <span>Pattern</span>
        <input
          className="text-input"
          maxLength={80}
          onChange={(event) => setField("pattern", event.target.value)}
          value={form.pattern}
        />
      </label>
      <label className="form-field">
        <span>Silhouette</span>
        <input
          className="text-input"
          maxLength={80}
          onChange={(event) => setField("silhouette", event.target.value)}
          value={form.silhouette}
        />
      </label>
      <label className="form-field">
        <span>Apparent material</span>
        <input
          className="text-input"
          maxLength={80}
          onChange={(event) => setField("material", event.target.value)}
          value={form.material}
        />
        <small className="form-field__hint">
          Visible material is an inference, not a verified fact.
        </small>
      </label>
    </>
  );
}
