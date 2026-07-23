export function WardrobeGridSkeleton({ listView }: { listView: boolean }) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading wardrobe"
      className={`wardrobe-grid${listView ? " wardrobe-grid--list" : ""}`}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div className="wardrobe-card wardrobe-card--skeleton" key={index}>
          <span />
          <i />
          <i />
        </div>
      ))}
    </section>
  );
}
