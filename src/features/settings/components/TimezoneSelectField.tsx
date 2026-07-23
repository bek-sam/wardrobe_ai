import { SelectField } from "@/components/ui/FormField";
import { timezoneOptions } from "@/features/settings/style-options.data";

export function TimezoneSelectField({
  timezone,
  onTimezone,
  disabled,
}: {
  timezone: string;
  onTimezone: (value: string) => void;
  disabled: boolean;
}) {
  const timezoneIsKnown = timezoneOptions.some((option) => option.value === timezone);
  return (
    <SelectField
      disabled={disabled}
      id="settings-timezone"
      label="Timezone"
      onChange={(event) => onTimezone(event.target.value)}
      value={timezone}
    >
      {!timezoneIsKnown ? <option value={timezone}>{timezone}</option> : null}
      {timezoneOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}
