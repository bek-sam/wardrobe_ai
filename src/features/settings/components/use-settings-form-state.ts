import { useState } from "react";

import { hydrateStyleForm } from "./hydrate-settings-forms";
import type {
  LocationFormState,
  Profile,
  ProfileFormState,
  StyleFormState,
} from "./settings.types";

export function useSettingsFormState() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: "",
    displayName: "",
    locale: "en-US",
  });
  const [locationForm, setLocationForm] = useState<LocationFormState>({
    homeLocation: "",
    timezone: "America/Chicago",
    temperatureUnit: "fahrenheit",
  });
  const [styleForm, setStyleForm] = useState<StyleFormState>(hydrateStyleForm(null));
  const [modeledPreviewConsent, setModeledPreviewConsent] = useState(false);
  const [identityReferencePath, setIdentityReferencePath] = useState<string | null>(null);

  return {
    profile,
    setProfile,
    profileForm,
    setProfileForm,
    locationForm,
    setLocationForm,
    styleForm,
    setStyleForm,
    modeledPreviewConsent,
    setModeledPreviewConsent,
    identityReferencePath,
    setIdentityReferencePath,
  };
}
