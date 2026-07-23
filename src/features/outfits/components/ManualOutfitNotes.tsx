import { WarningCircle } from "@phosphor-icons/react";

export function ManualOutfitNotes({
  availableCount,
  itemsCount,
  unresolvedCount,
  validationMessage,
  error,
}: {
  availableCount: number;
  itemsCount: number;
  unresolvedCount: number;
  validationMessage: string | null;
  error: string | null;
}) {
  return (
    <>
      {availableCount > itemsCount ? (
        <p className="outfit-builder-note">
          Showing the first {itemsCount} of {availableCount} available pieces.
        </p>
      ) : null}
      {unresolvedCount ? (
        <p className="outfit-builder-note">
          {unresolvedCount} {unresolvedCount === 1 ? "piece has" : "pieces have"} no outfit role yet
          and cannot be selected here. Add a layer role in Wardrobe to use it.
        </p>
      ) : null}
      {validationMessage ? <p className="outfit-builder-note">{validationMessage}</p> : null}
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
    </>
  );
}
