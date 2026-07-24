import { Check } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function PreviewWearCard() {
  return (
    <Card as="section" className="wear-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Wear history</p>
          <h2>8 wears</h2>
        </div>
        <Badge tone="sage">$6.25 / wear</Badge>
      </div>
      <div className="wear-card__chart" aria-label="Illustrative wear history chart">
        <span style={{ height: "28%" }} />
        <span style={{ height: "45%" }} />
        <span style={{ height: "32%" }} />
        <span style={{ height: "72%" }} />
        <span style={{ height: "52%" }} />
        <span style={{ height: "86%" }} />
      </div>
      <p>Last worn 12 days ago · Sample calculation</p>
      <Button variant="secondary">
        <Check size={16} /> Mark worn today
      </Button>
    </Card>
  );
}
