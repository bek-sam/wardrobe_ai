import type { Insights } from "./insights.types";

export function PaletteDescription({ insights }: { insights: Insights }) {
  if (!insights.colors.length) {
    return <p>Add color names to wardrobe pieces to build your palette.</p>;
  }
  return (
    <p>
      Your most-recorded colors are{" "}
      {insights.colors
        .slice(0, 3)
        .map((color) => color.name)
        .join(", ")}
      .
    </p>
  );
}
