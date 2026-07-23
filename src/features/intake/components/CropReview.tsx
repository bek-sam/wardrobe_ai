import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

import { titleCase } from "./import-text-helpers";
import type { BoundingBox, CropReviewProps } from "./import-workspace.types";

export function CropReview({ candidate, busy, onApprove }: CropReviewProps) {
  const [box, setBox] = useState(candidate.boundingBox);
  return (
    <form
      className="candidate-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onApprove(box);
      }}
    >
      <p className="candidate-review-copy">
        Check that the whole garment is visible. Coordinates use a 0–1000 image scale.
      </p>
      <div className="crop-field-grid">
        {(Object.keys(box) as Array<keyof BoundingBox>).map((key) => (
          <label key={key}>
            <span>{titleCase(key)}</span>
            <input
              className="text-input"
              max={key === "x" || key === "y" ? 999 : 1000}
              min={key === "x" || key === "y" ? 0 : 1}
              onChange={(event) =>
                setBox((current) => ({ ...current, [key]: Number(event.target.value) }))
              }
              required
              type="number"
              value={box[key]}
            />
          </label>
        ))}
      </div>
      <Button disabled={busy} type="submit">
        {busy ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
        Approve crop &amp; extract
      </Button>
    </form>
  );
}
