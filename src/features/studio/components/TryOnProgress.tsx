"use client";

const STEPS = [
  { status: "validating_inputs", label: "Preparing your exact pieces" },
  { status: "generating", label: "Creating the try-on" },
  { status: "qa_review", label: "Checking garment and identity fidelity" },
  { status: "localizing", label: "Mapping interactive garment details" },
] as const;

/**
 * Named steps, not a fabricated percentage. The backend genuinely moves
 * through these stages, so each one is truthful; a fake progress bar would
 * only be guessing at how long a two-minute image call has left.
 */
export function TryOnProgress({ status }: { status: string }) {
  const activeIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <div className="tryon-progress">
      <ol className="tryon-progress__steps">
        {STEPS.map((step, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
          return (
            <li className={`tryon-progress__step tryon-progress__step--${state}`} key={step.status}>
              <span aria-hidden="true" className="tryon-progress__marker" />
              {step.label}
              {state === "done" ? <span className="sr-only"> (finished)</span> : null}
              {state === "active" ? <span className="sr-only"> (in progress)</span> : null}
            </li>
          );
        })}
      </ol>
      <p className="tryon-progress__note">
        High-quality image generation can take up to about two minutes. You can leave this page and
        come back — the try-on keeps going.
      </p>
    </div>
  );
}
