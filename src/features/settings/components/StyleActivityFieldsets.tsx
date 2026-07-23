import { activityOptions, styleOptions } from "@/features/settings/style-options.data";
import { optionValue } from "@/features/settings/style-options-helpers";

import { ChoiceFieldset } from "./ChoiceFieldset";

export function StyleActivityFieldsets({
  disabled,
  styles,
  activities,
  onToggleStyle,
  onToggleActivity,
}: {
  disabled: boolean;
  styles: string[];
  activities: string[];
  onToggleStyle: (value: string) => void;
  onToggleActivity: (value: string) => void;
}) {
  return (
    <>
      <ChoiceFieldset
        disabled={disabled}
        legend="Style words"
        onToggle={onToggleStyle}
        options={styleOptions}
        selected={styles}
        valueFor={optionValue}
      />
      <ChoiceFieldset
        disabled={disabled}
        legend="Common activities"
        onToggle={onToggleActivity}
        options={activityOptions}
        selected={activities}
        valueFor={(option) => option.toLowerCase()}
      />
    </>
  );
}
