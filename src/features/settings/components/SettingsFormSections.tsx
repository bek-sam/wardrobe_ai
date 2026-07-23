import { LocationSection } from "./LocationSection";
import { ProfileSection } from "./ProfileSection";
import { StyleSizesSection } from "./StyleSizesSection";
import type { useSettingsManagerState } from "./use-settings-manager-state";

export function SettingsFormSections({
  state,
}: {
  state: ReturnType<typeof useSettingsManagerState>;
}) {
  return (
    <>
      <ProfileSection
        busy={state.busy}
        disabled={state.disabled}
        form={state.profileForm}
        onSubmit={state.saveProfile}
        setForm={state.setProfileForm}
      />
      <StyleSizesSection
        busy={state.busy}
        disabled={state.disabled}
        form={state.styleForm}
        onSubmit={state.saveStyle}
        onToggleActivity={state.toggleActivity}
        onToggleStyle={state.toggleStyle}
        setForm={state.setStyleForm}
      />
      <LocationSection
        busy={state.busy}
        disabled={state.disabled}
        form={state.locationForm}
        onSubmit={state.saveLocation}
        setForm={state.setLocationForm}
      />
    </>
  );
}
