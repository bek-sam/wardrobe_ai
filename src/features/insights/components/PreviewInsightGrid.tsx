import { CategoryChart } from "./CategoryChart";
import { PaletteCard } from "./PaletteCard";
import { PREVIEW_CATEGORY_BARS, PREVIEW_PALETTE } from "./preview-insights-data.data";

export function PreviewInsightGrid() {
  return (
    <div className="insight-grid">
      <CategoryChart
        ariaLabel="Sample category distribution bar chart"
        bars={PREVIEW_CATEGORY_BARS}
        caption="Sample percentages normalized for the preview wardrobe."
      />
      <PaletteCard
        ariaLabel="Sample wardrobe color palette"
        colors={PREVIEW_PALETTE}
        description={
          <p>This sample palette demonstrates how saved color metadata will be summarized.</p>
        }
      />
    </div>
  );
}
