import { DataOwnershipSection } from "./DataOwnershipSection";
import { PrivacySection } from "./PrivacySection";
import type { useSettingsManagerState } from "./use-settings-manager-state";

export function SettingsPrivacySections({
  state,
}: {
  state: ReturnType<typeof useSettingsManagerState>;
}) {
  return (
    <>
      <PrivacySection
        disabled={state.disabled}
        identityReferencePath={state.identityReferencePath}
        modeledPreviewConsent={state.modeledPreviewConsent}
        onToggleConsent={() => void state.toggleModeledPreviewConsent()}
        onUpload={(file) => void state.uploadIdentityReference(file)}
        previewConsentBusy={state.previewConsentBusy}
      />
      <DataOwnershipSection
        busy={state.busy}
        deleteOpen={state.deleteOpen}
        deletePassword={state.deletePassword}
        deletePhrase={state.deletePhrase}
        disabled={state.disabled}
        onCancelDelete={() => {
          state.setDeleteOpen(false);
          state.setDeletePhrase("");
          state.setDeletePassword("");
        }}
        onConfirmDelete={() => void state.deleteAccount()}
        onDeletePassword={state.setDeletePassword}
        onDeletePhrase={state.setDeletePhrase}
        onExport={() => void state.exportData()}
        onOpenDelete={() => state.setDeleteOpen(true)}
      />
    </>
  );
}
