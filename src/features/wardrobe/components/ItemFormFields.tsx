import { ItemFormCategoryBrandFields } from "./ItemFormCategoryBrandFields";
import { ItemFormColorFields } from "./ItemFormColorFields";
import { ItemFormNameImageFields } from "./ItemFormNameImageFields";
import { ItemFormNotesField } from "./ItemFormNotesField";
import type { ItemFormValues } from "./wardrobe-manager.types";

export function ItemFormFields({
  values,
  setField,
  onImage,
}: {
  values: ItemFormValues;
  setField: <Key extends keyof ItemFormValues>(key: Key, value: ItemFormValues[Key]) => void;
  onImage: (file: File | null) => void;
}) {
  return (
    <>
      <ItemFormNameImageFields
        name={values.name}
        onName={(value) => setField("name", value)}
        onImage={onImage}
      />
      <ItemFormCategoryBrandFields
        category={values.category}
        onCategory={(value) => setField("category", value)}
        brand={values.brand}
        onBrand={(value) => setField("brand", value)}
      />
      <ItemFormColorFields
        primaryColorHex={values.primaryColorHex}
        onPrimaryColorHex={(value) => setField("primaryColorHex", value)}
        colorNames={values.colorNames}
        onColorNames={(value) => setField("colorNames", value)}
      />
      <ItemFormNotesField notes={values.notes} onNotes={(value) => setField("notes", value)} />
    </>
  );
}
