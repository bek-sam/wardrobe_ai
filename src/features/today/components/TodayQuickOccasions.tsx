import { quickOccasions } from "./today-constants.data";

export function TodayQuickOccasions({
  occasion,
  onSelect,
  disabled,
}: {
  occasion: string;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="context-card__choices" aria-label="Common occasions">
      {quickOccasions.map((choice) => (
        <button
          aria-pressed={occasion === choice}
          className={occasion === choice ? "is-active" : ""}
          disabled={disabled}
          key={choice}
          onClick={() => onSelect(choice)}
          type="button"
        >
          {choice}
        </button>
      ))}
    </div>
  );
}
