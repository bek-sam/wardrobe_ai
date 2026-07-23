import { Sparkle } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

export function ImportTipCard() {
  return (
    <Card as="section" className="import-tip">
      <Sparkle size={21} weight="light" />
      <div>
        <h2>A better photo makes a better cutout</h2>
        <p>
          Use even light, keep the whole garment visible, and avoid covering sleeves, hems, or
          shoes.
        </p>
      </div>
    </Card>
  );
}
