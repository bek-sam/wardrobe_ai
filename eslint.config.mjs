import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "src/**/*.jsx",
    "src/**/*.js",
    "scripts/**/*.mjs",
    "vite.config.mjs",
  ]),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/**/schema.ts",
      "src/**/schemas.ts",
      "src/**/schemas/**",
      "src/**/types.ts",
      "src/**/*.d.ts",
      "src/**/constants.ts",
      "src/**/*-data.ts",
    ],
    rules: {
      "max-lines": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
    },
  },
]);
