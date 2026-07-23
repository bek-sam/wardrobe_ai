import { useEffect, useState } from "react";

import { fetchSettings } from "./fetch-settings";
import {
  hydrateLocationForm,
  hydrateProfileForm,
  hydrateStyleForm,
} from "./hydrate-settings-forms";
import { useSettingsFormState } from "./use-settings-form-state";
import type { Notice } from "./settings.types";

export function useSettingsLoad(
  configured: boolean,
  retry: number,
  setNotice: (notice: Notice | null) => void,
) {
  const state = useSettingsFormState();
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setNotice(null);
      fetchSettings(controller.signal)
        .then(({ profile: nextProfile, style: nextStyle }) => {
          state.setProfile(nextProfile);
          state.setProfileForm(hydrateProfileForm(nextProfile));
          state.setLocationForm(hydrateLocationForm(nextProfile));
          state.setStyleForm(hydrateStyleForm(nextStyle));
          state.setModeledPreviewConsent(nextProfile.modeled_preview_consent ?? false);
          state.setIdentityReferencePath(nextProfile.identity_reference_path ?? null);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : "Settings could not be loaded.",
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, retry]);

  return { ...state, loading };
}
