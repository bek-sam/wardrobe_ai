import { LiveWardrobeCard } from "./LiveWardrobeCard";
import type { LiveWardrobeItem } from "./wardrobe-manager.types";

export function WardrobeLiveGrid({
  items,
  listView,
  busyItemId,
  onEdit,
  onFavorite,
  onAvailability,
  onDelete,
}: {
  items: LiveWardrobeItem[];
  listView: boolean;
  busyItemId: string | null;
  onEdit: (item: LiveWardrobeItem) => void;
  onFavorite: (item: LiveWardrobeItem) => void;
  onAvailability: (item: LiveWardrobeItem, next: LiveWardrobeItem["availability_status"]) => void;
  onDelete: (item: LiveWardrobeItem) => void;
}) {
  return (
    <section
      aria-label="Wardrobe items"
      className={`wardrobe-grid${listView ? " wardrobe-grid--list" : ""}`}
    >
      {items.map((item) => (
        <LiveWardrobeCard
          busy={busyItemId === item.id}
          item={item}
          key={item.id}
          onAvailability={(next) => onAvailability(item, next)}
          onDelete={() => onDelete(item)}
          onEdit={() => onEdit(item)}
          onFavorite={() => onFavorite(item)}
        />
      ))}
    </section>
  );
}
