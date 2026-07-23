export function OptionalColorField({
  label,
  ariaLabel,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <span>{label}</span>
      <div className="optional-color-row">
        <input
          aria-label={ariaLabel}
          disabled={!value}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value || defaultValue}
        />
        <label className="check-row">
          <input
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked ? defaultValue : "")}
            type="checkbox"
          />
          Include
        </label>
      </div>
    </div>
  );
}
