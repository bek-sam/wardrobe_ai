"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) return error.message;
  }
  return fallback;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, `The request failed (${response.status}).`));
  }
  return payload.data;
}

type CompileStatusResponse = {
  dirty_since: string | null;
  last_compiled_at: string | null;
  candidate_count: number;
  compiled_wardrobe_version: string | null;
  latest_job_status: "queued" | "running" | "complete" | "failed" | null;
};

type RecompileResponse = { status: "up_to_date" | "running" | "queued" | "complete" };

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLastCompiled(value: string | null) {
  if (!value) return "never";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return "unknown";
  }
}

export function CompilationStatus({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<CompileStatusResponse | null>(null);
  const [recompiling, setRecompiling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      const result = await requestJson<CompileStatusResponse>("/api/wardrobe/compile");
      setStatus(result);
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

  if (!configured) return null;

  const jobStatus = status?.latest_job_status ?? null;
  const isRunning = recompiling || jobStatus === "queued" || jobStatus === "running";
  const isFailed = !isRunning && jobStatus === "failed";

  let headline: string;
  if (isRunning) {
    headline = "Recompiling your outfit library…";
  } else if (isFailed) {
    headline = "Your outfit library could not be recompiled. You can try again.";
  } else if (status?.dirty_since) {
    headline = "Outfit library: changes pending";
  } else if (status) {
    headline = `Outfit library: ${status.candidate_count} outfits ready`;
  } else {
    headline = "Outfit library: —";
  }

  return (
    <div className="wardrobe-compile-status" aria-live="polite">
      <div className="wardrobe-compile-status-text">
        <span>{headline}</span>
        <span className="wardrobe-compile-status-meta">
          Last compiled: {formatLastCompiled(status?.last_compiled_at ?? null)}
        </span>
        {notice ? <span className="wardrobe-compile-status-notice">{notice}</span> : null}
      </div>
      <Button
        aria-label={isFailed ? "Retry compiling your outfit library" : "Recompile outfit library"}
        disabled={isRunning}
        onClick={() => void recompileNow()}
        variant="ghost"
      >
        {isFailed ? "Retry" : "Recompile"}
      </Button>
    </div>
  );
}
