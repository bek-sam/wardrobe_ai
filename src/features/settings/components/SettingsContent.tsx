import { SettingsFormSections } from "./SettingsFormSections";
import { SettingsPrivacySections } from "./SettingsPrivacySections";
import type { useSettingsManagerState } from "./use-settings-manager-state";

export function SettingsContent({ state }: { state: ReturnType<typeof useSettingsManagerState> }) {
  return (
    <div className="settings-content">
      <SettingsFormSections state={state} />
      <SettingsPrivacySections state={state} />
    </div>
  );
}
