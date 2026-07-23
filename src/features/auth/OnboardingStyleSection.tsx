import { ChoiceFieldset } from "@/features/settings/components/ChoiceFieldset";
import { optionValue } from "@/features/settings/style-options-helpers";
import { styleOptions } from "@/features/settings/style-options.data";

export function OnboardingStyleSection({
  disabled,
  styles,
  onToggle,
}: {
  disabled: boolean;
  styles: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="form-section">
      <div className="form-section__heading">
        <span>02</span>
        <div>
          <h2>Your style</h2>
          <p>Choose any words that feel natural. There are no wrong answers.</p>
        </div>
      </div>
      <ChoiceFieldset
        disabled={disabled}
        legend="Style preferences"
        legendClassName="sr-only"
        onToggle={onToggle}
        options={styleOptions}
        selected={styles}
        valueFor={optionValue}
      />
    </div>
  );
}
