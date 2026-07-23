import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { Swatches } from "@phosphor-icons/react";

import { colorValue } from "./color-value";

export function PaletteCard({
  colors,
  ariaLabel,
  description,
}: {
  colors: string[];
  ariaLabel: string;
  description: ReactNode;
}) {
  return (
    <Card as="section" className="palette-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Color story</p>
          <h2>Your palette</h2>
        </div>
        <Swatches size={21} />
      </div>
      {colors.length ? (
        <div className="palette-orbit" aria-label={ariaLabel}>
          {colors.map((color) => (
            <span key={color} style={{ background: colorValue(color) }}>
              {color}
            </span>
          ))}
        </div>
      ) : null}
      {description}
    </Card>
  );
}
