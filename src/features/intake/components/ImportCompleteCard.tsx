import { Check, Plus } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ImportCompleteCard({ onStartAnother }: { onStartAnother: () => void }) {
  return (
    <Card className="import-complete-card">
      <span>
        <Check size={24} weight="bold" />
      </span>
      <div>
        <h2>Your reviewed pieces are in Wardrobe</h2>
        <p>The original, crop, and cutout lineage remains private.</p>
      </div>
      <ButtonLink href="/wardrobe">Open wardrobe</ButtonLink>
      <Button onClick={onStartAnother} variant="secondary">
        <Plus size={15} /> Import another
      </Button>
    </Card>
  );
}
