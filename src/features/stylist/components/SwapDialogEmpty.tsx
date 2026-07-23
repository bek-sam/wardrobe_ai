import { Button } from "@/components/ui/Button";

export function SwapDialogEmpty({ onClose }: { onClose: () => void }) {
  return (
    <div className="empty-state stylist-swap-empty">
      <h2>No available replacement</h2>
      <p>Your wardrobe has no other active, available item with the same resolved role.</p>
      <Button onClick={onClose} variant="secondary">
        Close
      </Button>
    </div>
  );
}
