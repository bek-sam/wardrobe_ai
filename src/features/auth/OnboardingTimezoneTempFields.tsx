import { SelectField } from "@/components/ui/SelectField";

export function OnboardingTimezoneTempFields({
  disabled,
  timezone,
  onTimezone,
  temperature,
  onTemperature,
}: {
  disabled: boolean;
  timezone: string;
  onTimezone: (value: string) => void;
  temperature: string;
  onTemperature: (value: string) => void;
}) {
  return (
    <>
      <SelectField
        disabled={disabled}
        id="timezone"
        label="Timezone"
        name="timezone"
        onChange={(event) => onTimezone(event.target.value)}
        value={timezone}
      >
        <option value="America/Chicago">Central Time</option>
        <option value="America/New_York">Eastern Time</option>
        <option value="America/Denver">Mountain Time</option>
        <option value="America/Los_Angeles">Pacific Time</option>
      </SelectField>
      <SelectField
        disabled={disabled}
        id="temperature"
        label="I usually feel"
        name="temperature"
        onChange={(event) => onTemperature(event.target.value)}
        value={temperature}
      >
        <option value="cold">Cold before others do</option>
        <option value="neutral">Comfortable at expected temperatures</option>
        <option value="hot">Warm before others do</option>
      </SelectField>
    </>
  );
}
