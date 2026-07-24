import { Trash } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/Button";

export function PreviewDangerZone() {
  return (
    <div className="item-danger">
      <div>
        <h2>Archive or delete</h2>
        <p>Archived pieces stay in history but are excluded from new recommendations.</p>
      </div>
      <div>
        <Button variant="ghost">Archive</Button>
        <Button variant="danger">
          <Trash size={15} /> Delete piece
        </Button>
      </div>
    </div>
  );
}
