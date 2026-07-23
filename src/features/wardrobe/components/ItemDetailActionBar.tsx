import { MagicWand, PencilSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function ItemDetailActionBar({ onToggleEdit }: { onToggleEdit: () => void }) {
  return (
    <div className="item-detail__actions">
      <Button onClick={onToggleEdit}>
        <PencilSimple size={16} /> Edit details
      </Button>
      <Button
        onClick={() =>
          document.getElementById("item-research")?.scrollIntoView({ behavior: "smooth" })
        }
        variant="secondary"
      >
        <MagicWand size={16} /> Research item
      </Button>
    </div>
  );
}
