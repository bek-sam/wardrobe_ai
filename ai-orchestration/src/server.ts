import { createAiOrchestrationApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3002", 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const app = createAiOrchestrationApp();
let closing = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "Stopping AI orchestration");
  await app.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

await app.listen({ host: process.env.HOST ?? "127.0.0.1", port });
