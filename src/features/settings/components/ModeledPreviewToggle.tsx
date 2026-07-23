export function ModeledPreviewToggle({
  hasReference,
  checked,
  disabled,
  onToggle,
}: {
  hasReference: boolean;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="toggle-row toggle-row--modeled-preview">
      <span>
        <strong>Modeled preview consent</strong>
        <small>
          {hasReference
            ? "Private modeled previews use your uploaded reference photo. Generated images are clearly labeled and never an accurate fit simulation."
            : "Upload a private reference photo to enable modeled previews of curated outfits."}
        </small>
      </span>
      <input
        checked={checked}
        disabled={disabled || !hasReference}
        onChange={onToggle}
        role="switch"
        type="checkbox"
      />
    </div>
  );
}
