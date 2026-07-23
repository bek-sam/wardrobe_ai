import { ArrowClockwise } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function RegeneratePanel({
  open,
  busy,
  initialTolerance,
  onRegenerate,
}: {
  open: boolean;
  busy: boolean;
  initialTolerance: number;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [tolerance, setTolerance] = useState(initialTolerance);
  return (
    <details className="regenerate-panel" open={open}>
      <summary>Regenerate cutout</summary>
      <label className="form-field">
        <span>What should change?</span>
        <textarea
          className="textarea-input"
          maxLength={1200}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Keep the full left sleeve and preserve the navy color."
          value={instruction}
        />
      </label>
      <label className="tolerance-control">
        <span>Background cleanup: {tolerance}</span>
        <input
          max={110}
          min={18}
          onChange={(event) => setTolerance(Number(event.target.value))}
          type="range"
          value={tolerance}
        />
      </label>
      <Button
        disabled={busy}
        onClick={() => void onRegenerate(instruction, tolerance)}
        variant="secondary"
      >
        <ArrowClockwise size={15} /> Regenerate
      </Button>
    </details>
  );
}
