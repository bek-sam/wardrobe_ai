import { ChoiceFieldset } from "@/features/settings/components/ChoiceFieldset";
import { activityOptions } from "@/features/settings/style-options.data";

export function OnboardingActivitySection({
  disabled,
  activities,
  onToggle,
}: {
  disabled: boolean;
  activities: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="form-section">
      <div className="form-section__heading">
        <span>03</span>
        <div>
          <h2>Your everyday</h2>
          <p>What do you most often get dressed for?</p>
        </div>
      </div>
      <ChoiceFieldset
        disabled={disabled}
        legend="Common activities"
        legendClassName="sr-only"
        onToggle={onToggle}
        options={activityOptions}
        selected={activities}
        valueFor={(option) => option.toLowerCase()}
      />
    </div>
  );
}
