import { spawn } from "node:child_process";
import fs from "node:fs";
import process, { loadEnvFile } from "node:process";

if (fs.existsSync(".env.local")) loadEnvFile(".env.local");

const processes = [
  spawn("npm", ["run", "dev", "-w", "@wardrobe/ai-orchestration"], {
    env: process.env,
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev", "-w", "@wardrobe/backend"], {
    env: process.env,
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev", "-w", "@wardrobe/worker"], {
    env: process.env,
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev:frontend"], {
    env: process.env,
    stdio: "inherit",
  }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (child.exitCode === null) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => stop(signal));
}

for (const child of processes) {
  child.once("error", (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      stop();
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
}

await Promise.all(
  processes.map(
    (child) =>
      new Promise((resolve) => {
        child.once("close", resolve);
      }),
  ),
);
