import { X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ImportCancelledCard({ onStartNew }: { onStartNew: () => void }) {
  return (
    <Card className="import-complete-card">
      <span>
        <X size={22} />
      </span>
      <div>
        <h2>Import cancelled</h2>
        <p>No garments from this job were added to your wardrobe.</p>
      </div>
      <Button onClick={onStartNew}>Start a new import</Button>
    </Card>
  );
}
