import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { requestJson } from "@/lib/api/request";

import { triggerWardrobeCompile } from "./wardrobe-manager.helpers";

export function useWardrobeMutate(setError: Dispatch<SetStateAction<string | null>>) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const mutate = useCallback(
    async <T>(itemId: string, path: string, init: RequestInit, apply: (data: T) => void) => {
      setBusyItemId(itemId);
      setError(null);
      try {
        const result = await requestJson<T>(path, init);
        apply(result);
        triggerWardrobeCompile();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The item could not be updated.");
      } finally {
        setBusyItemId(null);
      }
    },
    [setError],
  );

  return { mutate, busyItemId };
}
