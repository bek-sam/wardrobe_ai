"use client";

type Props = {
  legend: string;
  options: readonly string[];
  isSelected: (option: string) => boolean;
  onToggle: (option: string) => void;
};

/**
 * Selection is conveyed by `aria-pressed` and a border change, not by colour
 * alone, so the state survives a monochrome or high-contrast rendering.
 */
export function ComposerChips({ legend, options, isSelected, onToggle }: Props) {
  return (
    <fieldset className="composer-chips">
      <legend>{legend}</legend>
      <div className="composer-chips__row">
        {options.map((option) => {
          const selected = isSelected(option);
          return (
            <button
              aria-pressed={selected}
              className={`composer-chip${selected ? " composer-chip--on" : ""}`}
              key={option}
              onClick={() => onToggle(option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
