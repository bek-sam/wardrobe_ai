import { requestJson } from "@/lib/api/request";

import type { Notice, Profile } from "./settings.types";

export function useToggleModeledPreview(
  modeledPreviewConsent: boolean,
  setModeledPreviewConsent: (value: boolean) => void,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
  setNotice: (notice: Notice | null) => void,
  setBusy: (value: boolean) => void,
) {
  return async function toggleModeledPreviewConsent() {
    const next = !modeledPreviewConsent;
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestJson<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ modeled_preview_consent: next }),
      });
      setModeledPreviewConsent(result.modeled_preview_consent ?? next);
      setProfile((current) => (current ? { ...current, ...result } : current));
      setNotice({ tone: "success", message: "Your settings were saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your settings could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  };
}
