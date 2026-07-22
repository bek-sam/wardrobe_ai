import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    // These hit a real local Postgres/Auth instance (RPC round trips,
    // rate-limit windows) sequentially per file; give them more room than the
    // mocked unit suite.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // RLS/concurrency assertions rely on tests within a file running against
    // shared, file-scoped fixtures without another file's parallel run
    // stepping on the same rate-limit/debounce state.
    fileParallelism: false,
  },
});
