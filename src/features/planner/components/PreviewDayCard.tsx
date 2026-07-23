import { Plus, Sun } from "@phosphor-icons/react";

import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

export function PreviewDayCard({
  weekday,
  dayOfMonth,
  occasion,
  colors,
}: {
  weekday: string;
  dayOfMonth: number;
  occasion: string;
  colors: readonly string[];
}) {
  return (
    <article className="day-card">
      <header>
        <div>
          <span>{weekday}</span>
          <strong>{dayOfMonth}</strong>
        </div>
        <div>
          <Sun size={18} /> <span>Sample</span>
        </div>
      </header>
      <div className="day-card__occasion">{occasion}</div>
      {colors.length ? (
        <div className="day-card__look">
          <div>
            {colors.map((color, pieceIndex) => (
              <GarmentArtwork
                category={pieceIndex === 0 ? "top" : pieceIndex === 1 ? "bottom" : "layer"}
                color={color}
                compact
                key={color}
              />
            ))}
          </div>
          <strong>Sample look</strong>
        </div>
      ) : (
        <button className="day-card__empty" disabled type="button">
          <Plus size={20} /> <span>Preview only</span>
        </button>
      )}
    </article>
  );
}
