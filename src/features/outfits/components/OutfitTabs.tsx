import { Heart } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import type { OutfitFilter } from "./outfits-manager.types";

export function OutfitTabs({
  activeFilter,
  onChange,
  total,
}: {
  activeFilter: OutfitFilter;
  onChange: (filter: OutfitFilter) => void;
  total: number;
}) {
  const tab = (filter: OutfitFilter, label: ReactNode) => (
    <button
      className={activeFilter === filter ? "is-active" : ""}
      onClick={() => onChange(filter)}
      role="tab"
      aria-selected={activeFilter === filter}
      type="button"
    >
      {label} {activeFilter === filter ? <span>{total}</span> : null}
    </button>
  );
  return (
    <div className="outfit-tabs" role="tablist" aria-label="Outfit categories">
      {tab("all", "All looks")}
      {tab(
        "favorite",
        <>
          <Heart size={15} /> Favorites
        </>,
      )}
      {tab("worn", "Worn history")}
      {tab("ai", "AI created")}
    </div>
  );
}
