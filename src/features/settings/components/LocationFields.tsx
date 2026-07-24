import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";

import { TimezoneSelectField } from "./TimezoneSelectField";
import type { LocationFormState } from "./settings.types";

export function LocationFields({
  disabled,
  form,
  setForm,
}: {
  disabled: boolean;
  form: LocationFormState;
  setForm: (updater: (current: LocationFormState) => LocationFormState) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <TextField
        disabled={disabled}
        id="settings-location"
        label="Home location"
        maxLength={200}
        onChange={(event) =>
          setForm((current) => ({ ...current, homeLocation: event.target.value }))
        }
        placeholder="City or postal code"
        value={form.homeLocation}
      />
      <TimezoneSelectField
        disabled={disabled}
        onTimezone={(value) => setForm((current) => ({ ...current, timezone: value }))}
        timezone={form.timezone}
      />
      <SelectField
        disabled={disabled}
        id="settings-temperature-unit"
        label="Temperature"
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            temperatureUnit: event.target.value as "celsius" | "fahrenheit",
          }))
        }
        value={form.temperatureUnit}
      >
        <option value="fahrenheit">Fahrenheit</option>
        <option value="celsius">Celsius</option>
      </SelectField>
    </div>
  );
}
