import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createGenerator } from "./import-api/generate.mjs";
import { createJobStore } from "./import-api/job-store.mjs";
import { resumeIncompleteJobs } from "./import-api/resume.mjs";
import { createRouter } from "./import-api/routes.mjs";
import { createSetupStatus } from "./import-api/setup.mjs";

export function wardrobeImportApi(options = {}) {
  let handler;
  const setting = (name, fallback = "") => options.env?.[name] || process.env[name] || fallback;
  const apiBaseUrl = () => setting("OPENAI_API_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    name: "wardrobe-import-job-api",
    apply: "serve",
    async configResolved(config) {
      const root = config.root;
      const dataDir = path.resolve(root, setting("WARDROBE_DATA_DIR", "data"));
      const jobsDir = path.join(dataDir, "jobs");
      const importedFile = path.join(dataDir, "library.json");
      const libraryAssetDir = path.join(dataDir, "imported");
      await mkdir(jobsDir, { recursive: true });
      await mkdir(libraryAssetDir, { recursive: true });

      const store = createJobStore({ jobsDir, importedFile, libraryAssetDir });
      const setupStatus = createSetupStatus({ root, setting });
      const generator = createGenerator({ jobsDir, root, setting, apiBaseUrl, store, options });
      handler = createRouter({ jobsDir, importedFile, libraryAssetDir, setting, apiBaseUrl, store, generator, setupStatus });

      await resumeIncompleteJobs({ jobsDir, store, generator });
    },
    configureServer(server) { server.middlewares.use((req, res, next) => handler(req, res, next)); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => handler(req, res, next)); },
  };
}
