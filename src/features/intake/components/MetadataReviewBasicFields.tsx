import { MetadataReviewCategoryField } from "./MetadataReviewCategoryField";
import { MetadataReviewNameField } from "./MetadataReviewNameField";
import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewBasicFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
      <MetadataReviewNameField form={form} setField={setField} />
      <MetadataReviewCategoryField form={form} setField={setField} />
      <label className="form-field">
        <span>Subcategory</span>
        <input
          className="text-input"
          maxLength={80}
          onChange={(event) => setField("subcategory", event.target.value)}
          value={form.subcategory}
        />
      </label>
      <label className="form-field">
        <span>Color names</span>
        <input
          className="text-input"
          onChange={(event) => setField("colorNames", event.target.value)}
          placeholder="navy, cream"
          value={form.colorNames}
        />
      </label>
    </>
  );
}
