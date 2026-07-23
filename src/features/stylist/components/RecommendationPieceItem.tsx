import type { OutfitSelection, OwnedItem } from "./stylist.types";

export function RecommendationPieceItem({
  selection,
  index,
  detail,
  swapBusy,
  showSwap,
  onSwap,
}: {
  selection: OutfitSelection;
  index: number;
  detail: OwnedItem | undefined;
  swapBusy: boolean;
  showSwap: boolean;
  onSwap: () => void;
}) {
  return (
    <li>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>{detail?.name ?? "Owned item details unavailable"}</strong>
        <small>
          {selection.role} · {detail?.brand ?? detail?.category ?? "verified ID"}
        </small>
        <code>{selection.item_id}</code>
      </div>
      {showSwap ? (
        <button disabled={swapBusy} onClick={onSwap} type="button">
          Swap
        </button>
      ) : null}
    </li>
  );
}
