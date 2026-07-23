import { Shuffle, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import type { SwapState } from "./stylist.types";

export function SwapDialogForm({
  swap,
  swapBusy,
  onChangeReplacement,
  onCancel,
  onConfirm,
}: {
  swap: SwapState;
  swapBusy: boolean;
  onChangeReplacement: (replacementId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Available replacement</span>
        <select
          className="select-input"
          onChange={(event) => onChangeReplacement(event.target.value)}
          value={swap.replacementId}
        >
          {swap.candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.id}
            </option>
          ))}
        </select>
      </label>
      <div className="item-form-dialog__actions">
        <Button onClick={onCancel} variant="ghost">
          Cancel
        </Button>
        <Button disabled={swapBusy || !swap.replacementId} onClick={onConfirm}>
          {swapBusy ? <SpinnerGap className="spin" size={15} /> : <Shuffle size={15} />}
          Confirm swap
        </Button>
      </div>
    </>
  );
}
