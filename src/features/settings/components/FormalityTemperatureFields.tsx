import { SelectField } from "@/components/ui/FormField";

export function FormalityTemperatureFields({
  disabled,
  formality,
  onFormality,
  temperatureComfort,
  onTemperatureComfort,
}: {
  disabled: boolean;
  formality: string;
  onFormality: (value: string) => void;
  temperatureComfort: string;
  onTemperatureComfort: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <SelectField
        disabled={disabled}
        id="settings-formality"
        label="Typical formality"
        onChange={(event) => onFormality(event.target.value)}
        value={formality}
      >
        <option value="">No preference</option>
        <option value="1">Very casual</option>
        <option value="2">Mostly casual</option>
        <option value="3">Balanced</option>
        <option value="4">Usually polished</option>
        <option value="5">Formal</option>
      </SelectField>
      <SelectField
        disabled={disabled}
        id="settings-temperature-comfort"
        label="Temperature comfort"
        onChange={(event) => onTemperatureComfort(event.target.value)}
        value={temperatureComfort}
      >
        <option value="cold">I run cold</option>
        <option value="neutral">Neutral</option>
        <option value="hot">I run hot</option>
      </SelectField>
    </div>
  );
}
