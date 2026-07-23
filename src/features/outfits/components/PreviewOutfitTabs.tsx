import { Heart } from "@phosphor-icons/react";

export function PreviewOutfitTabs({ total }: { total: number }) {
  return (
    <div className="outfit-tabs" role="tablist" aria-label="Preview outfit categories">
      <button className="is-active" role="tab" aria-selected="true" type="button">
        All looks <span>{total}</span>
      </button>
      <button disabled role="tab" aria-selected="false" type="button">
        <Heart size={15} /> Favorites
      </button>
      <button disabled role="tab" aria-selected="false" type="button">
        Worn history
      </button>
      <button disabled role="tab" aria-selected="false" type="button">
        AI created
      </button>
    </div>
  );
}
