import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Written by `npx supabase start` (the bundled edge runtime). Generated,
    // gitignored, and not ours to lint — but ESLint's flat config does not read
    // nested .gitignore files, so without this the documented local workflow
    // (`supabase start --workdir database`, then `npm run check`) fails on vendored output.
    "database/supabase/.temp/**",
    "legacy/**",
    "src/**/*.jsx",
    "src/**/*.js",
    "scripts/**/*.mjs",
    "vite.config.mjs",
  ]),
]);
