import { OnboardingNameLocationFields } from "./OnboardingNameLocationFields";
import { OnboardingSectionHeading } from "./OnboardingSectionHeading";
import { OnboardingTimezoneTempFields } from "./OnboardingTimezoneTempFields";

export function OnboardingBasicsSection({
  disabled,
  firstName,
  onFirstName,
  homeLocation,
  onHomeLocation,
  timezone,
  onTimezone,
  temperature,
  onTemperature,
}: {
  disabled: boolean;
  firstName: string;
  onFirstName: (value: string) => void;
  homeLocation: string;
  onHomeLocation: (value: string) => void;
  timezone: string;
  onTimezone: (value: string) => void;
  temperature: string;
  onTemperature: (value: string) => void;
}) {
  return (
    <div className="form-section">
      <OnboardingSectionHeading
        description="Enough context to get the forecast and fit right."
        step="01"
        title="Your basics"
      />
      <div className="form-grid form-grid--two">
        <OnboardingNameLocationFields
          disabled={disabled}
          firstName={firstName}
          homeLocation={homeLocation}
          onFirstName={onFirstName}
          onHomeLocation={onHomeLocation}
        />
        <OnboardingTimezoneTempFields
          disabled={disabled}
          onTemperature={onTemperature}
          onTimezone={onTimezone}
          temperature={temperature}
          timezone={timezone}
        />
      </div>
    </div>
  );
}
