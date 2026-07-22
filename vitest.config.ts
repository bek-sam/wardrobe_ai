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
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Integration tests hit a real local Supabase instance and have their own
    // config/runner (`npm run test:integration`) -- keep them out of the
    // default mocked unit-test run.
    exclude: ["node_modules/**", "tests/integration/**"],
    coverage: {
      reporter: ["text", "html", "lcov"],
    },
  },
});
