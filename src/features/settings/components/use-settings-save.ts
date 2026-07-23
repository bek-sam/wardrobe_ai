import { useCallback, useState } from "react";

import { requestJson } from "@/lib/api/request";

import type { Notice, Profile, StyleProfile } from "./settings.types";

export function useSettingsSave() {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const save = useCallback(async (key: string, path: string, body: Record<string, unknown>) => {
    setBusy(key);
    setNotice(null);
    try {
      const result = await requestJson<Profile | StyleProfile>(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setNotice({ tone: "success", message: "Your settings were saved." });
      return result;
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your settings could not be saved.",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  return { busy, setBusy, notice, setNotice, save };
}
