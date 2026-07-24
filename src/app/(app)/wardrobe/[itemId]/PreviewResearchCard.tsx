import { Check, Clock, MagicWand } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function PreviewResearchCard() {
  return (
    <Card as="section" className="research-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Product research</p>
          <h2>Identity not researched</h2>
        </div>
        <Badge tone="neutral">Not started</Badge>
      </div>
      <p>
        Research uses confirmed label text, brand clues, or a model number. Similar appearance alone
        is never treated as proof.
      </p>
      <div className="research-card__clues">
        <span>
          <Check size={14} /> Category confirmed
        </span>
        <span>
          <Clock size={14} /> Add label or SKU for stronger results
        </span>
      </div>
      <Button variant="secondary">
        <MagicWand size={16} /> Start source-backed research
      </Button>
    </Card>
  );
}
