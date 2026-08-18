import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { wardrobeImportApi } from "./scripts/import-job-api.mjs";
import { responsiveImageApi } from "./scripts/responsive-image-api.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // The transition Next app still owns the shared manifest/icon and the
    // one-time service-worker cleanup asset while parity review is active.
    publicDir: "../public",
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      // The import API spends the OpenAI key and writes local files, so the
      // dev server must never listen beyond loopback.
      host: "127.0.0.1",
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      allowedHosts: ["localhost"],
    },
    plugins: [react(), responsiveImageApi(), wardrobeImportApi({ env })],
  };
});
