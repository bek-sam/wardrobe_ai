import { OptionalColorField } from "./OptionalColorField";
import type { MetadataForm, MetadataSetField } from "./import-workspace.types";

export function MetadataReviewColorFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
      <OptionalColorField
        ariaLabel="Primary garment color"
        defaultValue="#8b7d6b"
        label="Primary color"
        onChange={(value) => setField("primaryColorHex", value)}
        value={form.primaryColorHex}
      />
      <OptionalColorField
        ariaLabel="Secondary garment color"
        defaultValue="#d6d0c5"
        label="Secondary color"
        onChange={(value) => setField("secondaryColorHex", value)}
        value={form.secondaryColorHex}
      />
    </>
  );
}
