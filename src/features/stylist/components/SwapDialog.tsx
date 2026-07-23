import { SwapDialogEmpty } from "./SwapDialogEmpty";
import { SwapDialogForm } from "./SwapDialogForm";
import { SwapDialogHeader } from "./SwapDialogHeader";
import type { SwapState } from "./stylist.types";

export function SwapDialog({
  swap,
  swapBusy,
  onClose,
  onChangeReplacement,
  onConfirm,
}: {
  swap: SwapState;
  swapBusy: boolean;
  onClose: () => void;
  onChangeReplacement: (replacementId: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="swap-title"
        aria-modal="true"
        className="stylist-swap-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <SwapDialogHeader onClose={onClose} role={swap.role} />
        {swap.candidates.length ? (
          <SwapDialogForm
            onCancel={onClose}
            onChangeReplacement={onChangeReplacement}
            onConfirm={onConfirm}
            swap={swap}
            swapBusy={swapBusy}
          />
        ) : (
          <SwapDialogEmpty onClose={onClose} />
        )}
      </section>
    </div>
  );
}
