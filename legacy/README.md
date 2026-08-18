# Legacy

The isolated Vite/JSON prototype is retained only for parity review and one-time data migration. Its UI, Vite middleware, local import pipeline, and browser storage implementation live entirely in this project.

Run it from the repository root with `npm run legacy:dev`. Its ignored local data directory is `legacy/data/`. No production project may import from `legacy`.
