import process from "node:process";

import { createWorkerPoll } from "./dispatcher.js";
import { runWorker } from "./runtime.js";

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => controller.abort(signal));
}

await runWorker({
  signal: controller.signal,
  pollIntervalMs: 1_000,
  poll: createWorkerPoll(),
  onPollError: (error) => {
    console.error(
      JSON.stringify({
        event: "storage_deletion_poll_failed",
        message: error instanceof Error ? error.message : "Unknown worker error",
      }),
    );
  },
});
