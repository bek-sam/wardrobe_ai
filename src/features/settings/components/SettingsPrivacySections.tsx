import { DataOwnershipSection } from "./DataOwnershipSection";
import { PrivacySection } from "./PrivacySection";
import { SecuritySection } from "./SecuritySection";
import type { useSettingsManagerState } from "./use-settings-manager-state";

export function SettingsPrivacySections({
  state,
}: {
  state: ReturnType<typeof useSettingsManagerState>;
}) {
  return (
    <>
      <SecuritySection security={state.security} setNotice={state.setNotice} />
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
        // Defaults to true while the account is still loading, so the form
        // never offers a passwordless deletion path it has not confirmed.
        hasPassword={state.security.account?.hasPassword ?? true}
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
        onReauthenticate={() => void state.reauthenticate()}
      />
    </>
  );
}
