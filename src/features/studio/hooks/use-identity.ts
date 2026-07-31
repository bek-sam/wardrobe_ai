"use client";

import { useCallback, useEffect, useState } from "react";

import {
  activateIdentityReference,
  fetchIdentityState,
  revokeIdentityReference,
  uploadIdentityPhoto,
} from "../api/identity-client";
import type { IdentityState } from "../types";

export function useIdentity() {
  const [state, setState] = useState<IdentityState | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await fetchIdentityState(controller.signal);
        if (!controller.signal.aborted) setState(next);
      } catch {
        // The gate renders its unconfigured state; nothing else depends on this.
      }
    })();
    return () => controller.abort();
  }, [version]);

  const run = useCallback(async (action: () => Promise<string | null>) => {
    setBusy(true);
    try {
      setMessage(await action());
      setVersion((previous) => previous + 1);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    busy,
    message,
    upload: (file: File) =>
      run(async () => (await uploadIdentityPhoto(file)).assessment.userMessage),
    activate: (id: string) => run(async () => (await activateIdentityReference(id), null)),
    revoke: (deleteAssets: boolean) =>
      run(async () => (await revokeIdentityReference(deleteAssets), "AI try-on is turned off.")),
  };
}
