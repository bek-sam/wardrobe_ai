import { ItemFormPrimaryColorField } from "./ItemFormPrimaryColorField";

export function ItemFormColorFields({
  primaryColorHex,
  onPrimaryColorHex,
  colorNames,
  onColorNames,
}: {
  primaryColorHex: string;
  onPrimaryColorHex: (value: string) => void;
  colorNames: string;
  onColorNames: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <ItemFormPrimaryColorField
        onPrimaryColorHex={onPrimaryColorHex}
        primaryColorHex={primaryColorHex}
      />
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-color-names">Color names</label>
          <span>Comma separated</span>
        </div>
        <input
          className="text-input"
          id="item-color-names"
          onChange={(event) => onColorNames(event.target.value)}
          placeholder="navy, cream"
          value={colorNames}
        />
      </div>
    </div>
  );
}
