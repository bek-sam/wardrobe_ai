import { useState } from "react";

import { useAccountSecurity } from "./use-account-security";
import { useDataOwnership } from "./use-data-ownership";
import { usePrivacySection } from "./use-privacy-section";
import { useSaveLocation } from "./use-save-location";
import { useSaveProfile } from "./use-save-profile";
import { useSaveStyle } from "./use-save-style";
import { useSettingsLoad } from "./use-settings-load";
import { useSettingsSave } from "./use-settings-save";
import { useStyleToggles } from "./use-style-toggles";

export function useSettingsManagerState(configured: boolean) {
  const [retry, setRetry] = useState(0);
  const [activeSection, setActiveSection] = useState("settings-profile");
  const { busy, setBusy, notice, setNotice, save } = useSettingsSave();
  const data = useSettingsLoad(configured, retry, setNotice);

  const disabled = !configured || data.loading || busy !== null || data.profile === null;
  const saveProfile = useSaveProfile(data.profileForm, save, data.setProfile);
  const saveStyle = useSaveStyle(data.styleForm, save);
  const saveLocation = useSaveLocation(data.locationForm, save, data.setProfile);
  const toggles = useStyleToggles(data.styleForm, data.setStyleForm);
  const privacy = usePrivacySection(
    data.modeledPreviewConsent,
    data.setModeledPreviewConsent,
    data.setIdentityReferencePath,
    data.setProfile,
    setNotice,
  );
  const dataOwnership = useDataOwnership(data.profile, setBusy, setNotice);
  // Loaded once here and shared: both the security area and the deletion form
  // need to know which sign-in methods exist, and two fetches could disagree.
  const security = useAccountSecurity(configured);

  return {
    ...data,
    configured,
    security,
    retry,
    setRetry,
    activeSection,
    setActiveSection,
    busy,
    notice,
    setNotice,
    disabled,
    saveProfile,
    saveStyle,
    saveLocation,
    ...toggles,
    ...privacy,
    ...dataOwnership,
  };
}
