import { useState } from "react";

import { uploadIdentityReferenceFile } from "./upload-identity-reference";
import { useToggleModeledPreview } from "./use-toggle-modeled-preview";
import type { Notice, Profile } from "./settings.types";

export function usePrivacySection(
  modeledPreviewConsent: boolean,
  setModeledPreviewConsent: (value: boolean) => void,
  setIdentityReferencePath: (value: string | null) => void,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
  setNotice: (notice: Notice | null) => void,
) {
  const [previewConsentBusy, setPreviewConsentBusy] = useState(false);
  const toggleModeledPreviewConsent = useToggleModeledPreview(
    modeledPreviewConsent,
    setModeledPreviewConsent,
    setProfile,
    setNotice,
    setPreviewConsentBusy,
  );

  async function uploadIdentityReference(file: File) {
    setPreviewConsentBusy(true);
    setNotice(null);
    try {
      const result = await uploadIdentityReferenceFile(file);
      setIdentityReferencePath(result.identity_reference_path ?? null);
      setProfile((current) => (current ? { ...current, ...result } : current));
      setNotice({ tone: "success", message: "Identity reference photo saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The reference photo could not be saved.",
      });
    } finally {
      setPreviewConsentBusy(false);
    }
  }

  return { previewConsentBusy, uploadIdentityReference, toggleModeledPreviewConsent };
}
