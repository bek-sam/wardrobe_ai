export function TodayOccasionInput({
  occasion,
  onOccasion,
  disabled,
  coreLoading,
  itemCount,
}: {
  occasion: string;
  onOccasion: (value: string) => void;
  disabled: boolean;
  coreLoading: boolean;
  itemCount: number;
}) {
  return (
    <>
      <label className="form-field" htmlFor="today-occasion">
        <span>Occasion or dress code</span>
        <input
          className="text-input"
          disabled={disabled}
          id="today-occasion"
          maxLength={120}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="For example: client meeting, then dinner"
          value={occasion}
        />
      </label>
      <div className="today-context-form__meta">
        <span>
          {coreLoading
            ? "Loading your wardrobe…"
            : itemCount
              ? `${itemCount} active ${itemCount === 1 ? "item" : "items"}; availability is filtered before styling.`
              : "Add clothes before requesting an owned-item outfit."}
        </span>
      </div>
    </>
  );
}
