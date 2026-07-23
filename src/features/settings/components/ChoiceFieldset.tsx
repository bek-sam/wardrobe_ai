export function ChoiceFieldset({
  legend,
  legendClassName,
  options,
  selected,
  onToggle,
  disabled,
  valueFor,
}: {
  legend: string;
  legendClassName?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled: boolean;
  valueFor: (option: string) => string;
}) {
  return (
    <fieldset className="choice-fieldset" disabled={disabled}>
      <legend className={legendClassName}>{legend}</legend>
      <div className="choice-grid">
        {options.map((option) => {
          const value = valueFor(option);
          return (
            <label className="choice-chip" key={option}>
              <input
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
                type="checkbox"
                value={value}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
