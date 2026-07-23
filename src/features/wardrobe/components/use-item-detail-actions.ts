import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export function useItemDetailActions(setError: Dispatch<SetStateAction<string | null>>) {
  const [busy, setBusy] = useState<string | null>(null);

  async function action(name: string, operation: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  return { busy, action };
}
