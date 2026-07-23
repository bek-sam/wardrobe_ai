export function WardrobeFilterTextInputs({
  brand,
  onBrand,
  color,
  onColor,
}: {
  brand: string;
  onBrand: (value: string) => void;
  color: string;
  onColor: (value: string) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Brand</span>
        <input
          className="text-input"
          onChange={(event) => onBrand(event.target.value)}
          placeholder="Any brand"
          type="search"
          value={brand}
        />
      </label>
      <label className="form-field">
        <span>Color name</span>
        <input
          className="text-input"
          onChange={(event) => onColor(event.target.value)}
          placeholder="navy"
          type="search"
          value={color}
        />
      </label>
    </>
  );
}
