import { useState } from "react";

import { requestJson } from "@/lib/api/request";

import type { Notice } from "./settings.types";

/**
 * Mutations for the security area that are not owned by a panel of their own.
 *
 * Linking Google goes through our own POST route rather than a client-side
 * provider call, so it inherits the origin check and the server-side feature
 * flag; the browser only follows the URL Supabase hands back.
 */
export function useSecurityActions(reload: () => Promise<void>, setNotice: (n: Notice) => void) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      await reload();
      setNotice({ tone: "success", message: success });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "That change could not be applied.",
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    unlinkIdentity: (identityId: string) =>
      run(async () => {
        if (!window.confirm("Remove this sign-in method from your account?")) return;
        await requestJson("/api/auth/identities/unlink", {
          method: "POST",
          body: JSON.stringify({ identityId }),
        });
      }, "That sign-in method was removed."),

    removeFactor: (factorId: string) =>
      run(async () => {
        if (!window.confirm("Turn off two-factor authentication for this account?")) return;
        await requestJson("/api/auth/mfa/unenroll", {
          method: "POST",
          body: JSON.stringify({ factorId }),
        });
      }, "Two-factor authentication is off."),

    refresh: (message: string) => run(async () => undefined, message),
  };
}
