import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: "service-aware-performance-alias",
      enforce: "pre",
      async resolveId(source, importer) {
        if (!source.startsWith("@/")) return null;
        const owner = importer?.includes(`${path.sep}worker${path.sep}`)
          ? "worker/src"
          : importer?.includes(`${path.sep}backend${path.sep}`)
            ? "backend/src"
            : "src";
        return this.resolve(path.join(root, owner, source.slice(2)), importer, { skipSelf: true });
      },
    },
  ],
  resolve: {
    alias: {
      "@backend": path.join(root, "backend/src"),
      "@worker": path.join(root, "worker/src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/performance/**/*.bench.ts"],
  },
});
