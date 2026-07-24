import { TextField } from "@/components/ui/TextField";

export function OnboardingNameLocationFields({
  disabled,
  firstName,
  onFirstName,
  homeLocation,
  onHomeLocation,
}: {
  disabled: boolean;
  firstName: string;
  onFirstName: (value: string) => void;
  homeLocation: string;
  onHomeLocation: (value: string) => void;
}) {
  return (
    <>
      <TextField
        disabled={disabled}
        id="first-name"
        label="First name"
        maxLength={100}
        name="firstName"
        onChange={(event) => onFirstName(event.target.value)}
        placeholder="Your first name"
        value={firstName}
      />
      <TextField
        disabled={disabled}
        id="home-location"
        label="Home location"
        maxLength={200}
        name="homeLocation"
        onChange={(event) => onHomeLocation(event.target.value)}
        placeholder="City or postal code"
        value={homeLocation}
      />
    </>
  );
}
