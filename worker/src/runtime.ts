export interface WorkerRuntimeOptions {
  signal: AbortSignal;
  poll: (signal: AbortSignal) => Promise<number>;
  pollIntervalMs?: number;
  onPollError?: (error: unknown) => void;
}

function waitForNextPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(finish, delayMs);
    signal.addEventListener("abort", finish, { once: true });

    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
  });
}

export async function runWorker(options: WorkerRuntimeOptions): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 10) {
    throw new Error("pollIntervalMs must be an integer of at least 10 milliseconds.");
  }

  while (!options.signal.aborted) {
    try {
      const handled = await options.poll(options.signal);
      if (handled > 0) continue;
    } catch (error) {
      options.onPollError?.(error);
    }

    await waitForNextPoll(pollIntervalMs, options.signal);
  }
}
