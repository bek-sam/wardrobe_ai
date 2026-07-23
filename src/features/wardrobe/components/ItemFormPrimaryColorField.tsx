export function ItemFormPrimaryColorField({
  primaryColorHex,
  onPrimaryColorHex,
}: {
  primaryColorHex: string;
  onPrimaryColorHex: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="item-color">Primary color</label>
      </div>
      <div className="optional-color-row">
        <input
          aria-label="Choose primary color"
          id="item-color"
          disabled={!primaryColorHex}
          onChange={(event) => onPrimaryColorHex(event.target.value)}
          type="color"
          value={primaryColorHex || "#8b7d6b"}
        />
        <label className="check-row">
          <input
            checked={Boolean(primaryColorHex)}
            onChange={(event) => onPrimaryColorHex(event.target.checked ? "#8b7d6b" : "")}
            type="checkbox"
          />
          Include
        </label>
      </div>
    </div>
  );
}
