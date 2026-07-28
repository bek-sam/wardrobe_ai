import { useCallback, useEffect, useState } from "react";

import type { AccountSecurity } from "@/features/settings/account-security.types";
import { requestJson } from "@/lib/api/request";

/**
 * Loads the account's security state.
 *
 * Refetched after every mutation rather than patched locally: enrolling a
 * factor, changing an email, or unlinking an identity each change several
 * derived flags at once (assurance level, which methods can still recover the
 * account), and a stale local copy would offer controls that no longer apply.
 */
export function useAccountSecurity(configured: boolean) {
  const [account, setAccount] = useState<AccountSecurity | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      setAccount(await requestJson<AccountSecurity>("/api/account/security"));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your security settings.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    // Deferred to a task so the first load does not set state during the
    // effect body, which would trigger a cascading render.
    const timeout = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timeout);
  }, [reload]);

  return { account, loading, error, reload };
}
