import { categoryFilters } from "./wardrobe-manager.constants";

export function WardrobeCategoryTabs({
  category,
  onCategory,
  total,
  hasQuery,
}: {
  category: string;
  onCategory: (value: string) => void;
  total: number;
  hasQuery: boolean;
}) {
  return (
    <div className="category-tabs" role="tablist" aria-label="Wardrobe categories">
      {categoryFilters.map((filter) => (
        <button
          className={category === filter.value ? "is-active" : ""}
          key={filter.value || "all"}
          role="tab"
          aria-selected={category === filter.value}
          onClick={() => onCategory(filter.value)}
          type="button"
        >
          {filter.label}
          {!filter.value && !hasQuery ? <span>{total}</span> : null}
        </button>
      ))}
    </div>
  );
}
