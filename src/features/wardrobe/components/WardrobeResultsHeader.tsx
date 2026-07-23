import { CompilationStatus } from "./CompilationStatus";

export function WardrobeResultsHeader({
  configured,
  loading,
  total,
  sort,
  onSort,
}: {
  configured: boolean;
  loading: boolean;
  total: number;
  sort: string;
  onSort: (value: string) => void;
}) {
  return (
    <div className="wardrobe-results">
      <p>{loading ? "Loading wardrobe…" : `${total} ${total === 1 ? "piece" : "pieces"}`}</p>
      <CompilationStatus configured={configured} />
      <select
        aria-label="Sort wardrobe"
        onChange={(event) => onSort(event.target.value)}
        value={sort}
      >
        <option value="recent">Recently added</option>
        <option value="worn">Most worn</option>
        <option value="name">Name A–Z</option>
      </select>
    </div>
  );
}
