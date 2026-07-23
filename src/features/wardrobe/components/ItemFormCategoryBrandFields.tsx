import { categoryOptions } from "./wardrobe-manager.constants";
import { titleCase } from "./wardrobe-manager.helpers";

export function ItemFormCategoryBrandFields({
  category,
  onCategory,
  brand,
  onBrand,
}: {
  category: string;
  onCategory: (value: string) => void;
  brand: string;
  onBrand: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-category">Category</label>
        </div>
        <select
          className="select-input"
          id="item-category"
          onChange={(event) => onCategory(event.target.value)}
          value={category}
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {titleCase(option)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-brand">Brand</label>
          <span>Optional</span>
        </div>
        <input
          className="text-input"
          id="item-brand"
          maxLength={120}
          onChange={(event) => onBrand(event.target.value)}
          value={brand}
        />
      </div>
    </div>
  );
}
