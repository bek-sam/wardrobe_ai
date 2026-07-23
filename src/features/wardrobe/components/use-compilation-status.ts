import { useCallback, useEffect, useState } from "react";

import { requestJson } from "@/lib/api/request";

import type { CompileStatusResponse, RecompileResponse } from "./compilation-status.types";

export function useCompilationStatus(configured: boolean) {
  const [status, setStatus] = useState<CompileStatusResponse | null>(null);
  const [recompiling, setRecompiling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      setStatus(await requestJson<CompileStatusResponse>("/api/wardrobe/compile"));
    } catch {
      // The outfit-library status is a non-critical widget; ignore failures.
    }
  }, [configured]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  async function recompileNow() {
    setRecompiling(true);
    setNotice(null);
    try {
      const result = await requestJson<RecompileResponse>("/api/wardrobe/compile", {
        method: "POST",
      });
      setNotice(
        result.status === "up_to_date"
          ? "Your outfit library is already up to date."
          : result.status === "running"
            ? "A recompile is already in progress."
            : "Recompiling your outfit library…",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Your outfit library could not be recompiled right now.",
      );
    } finally {
      setRecompiling(false);
      void refresh();
    }
  }

  return { status, recompiling, notice, recompileNow };
}
