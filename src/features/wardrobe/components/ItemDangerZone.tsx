import { ItemArchiveButton } from "./ItemArchiveButton";
import { ItemDeleteButton } from "./ItemDeleteButton";

export function ItemDangerZone({
  itemId,
  itemName,
  action,
  onDone,
}: {
  itemId: string;
  itemName: string;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDone: () => void;
}) {
  return (
    <div className="item-danger">
      <div>
        <h2>Archive or delete</h2>
        <p>Archived pieces remain in history but are excluded from recommendations.</p>
      </div>
      <div>
        <ItemArchiveButton action={action} itemId={itemId} onDone={onDone} />
        <ItemDeleteButton action={action} itemId={itemId} itemName={itemName} onDone={onDone} />
      </div>
    </div>
  );
}
