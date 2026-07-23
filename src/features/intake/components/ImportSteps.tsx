import { Check } from "@phosphor-icons/react";

import { steps } from "./import-workspace-constants.data";

export function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="import-steps">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const complete = stepNumber < current;
        return (
          <li
            className={complete ? "is-complete" : stepNumber === current ? "is-active" : ""}
            key={step.number}
          >
            <span>{complete ? <Check size={13} weight="bold" /> : step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.copy}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
