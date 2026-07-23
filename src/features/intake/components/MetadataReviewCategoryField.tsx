import { categoryOptions } from "./import-workspace-constants.data";
import { titleCase } from "./import-text-helpers";
import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewCategoryField({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <label className="form-field">
      <span>Category</span>
      <select
        className="select-input"
        onChange={(event) => setField("category", event.target.value)}
        value={form.category}
      >
        {categoryOptions.map((category) => (
          <option key={category} value={category}>
            {titleCase(category)}
          </option>
        ))}
      </select>
    </label>
  );
}
