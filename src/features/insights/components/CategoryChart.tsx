import { ChartBar } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

export function CategoryChart({
  bars,
  caption,
  ariaLabel,
}: {
  bars: Array<{ name: string; percent: number }>;
  caption: string;
  ariaLabel: string;
}) {
  return (
    <Card as="section" className="category-chart-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Closet balance</p>
          <h2>Category distribution</h2>
        </div>
        <ChartBar size={21} />
      </div>
      <div className="category-bars" aria-label={ariaLabel}>
        {bars.map((bar) => (
          <div key={bar.name}>
            <span>{bar.name}</span>
            <div>
              <i style={{ width: `${Math.max(4, bar.percent)}%` }} />
            </div>
            <strong>{bar.percent}%</strong>
          </div>
        ))}
      </div>
      <p className="chart-caption">{caption}</p>
    </Card>
  );
}
