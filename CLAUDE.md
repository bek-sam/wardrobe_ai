# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Wardrobe AI is a private, account-based clothing assistant: Next.js (App Router) + TypeScript + Supabase (Postgres/Auth/Storage) + OpenAI + Open-Meteo. It turns owned garments into a searchable wardrobe, source-backed product research, weather-aware outfit recommendations, plans, wear history, and insights.

A legacy Vite prototype (`src/*.jsx`, `src/features/import`, `scripts/import-api`, `data/library.json`) still exists behind `legacy:*` scripts for reference during parity review. **Do not wire production Next.js code to the legacy JSON store or the old cache-first service worker.**

## Commands

```bash
npm run dev              # Next.js dev server (webpack), http://localhost:3000
npm run build             # production build
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit (strict)
npm test                   # Vitest unit tests (single run)
npm run test:watch         # Vitest watch mode
npx vitest run tests/unit/planner.test.ts   # run a single test file
npx vitest run -t "test name"               # run tests matching a name
npm run test:e2e           # Playwright e2e (spins up dev server itself)
npm run format:check       # Prettier check
npm run format              # Prettier write
npm run check               # format:check + lint + typecheck + test + build + legacy:build (full local gate; mirrors CI)
```

Legacy prototype: `npm run legacy:dev`, `npm run legacy:build`, `npm run legacy:preview`.

Legacy data migration: `npm run migrate:legacy -- --user-id <uuid>` (dry-run by default; add `--apply` only after reviewing dry-run output — scoped to one destination user, safe to rerun).

Local Supabase:

```bash
npx supabase start
npx supabase db reset      # applies supabase/migrations in order
npm run test:integration   # Vitest against the real local instance (RLS, RPCs, concurrency); reads `supabase status` automatically
```

CI (`.github/workflows/ci.yml`) runs format:check, lint, typecheck, unit tests, build, legacy:build, then separate integration (local Supabase) and Playwright jobs — mirror this before pushing.

## Environment

Model IDs are intentionally not hard-coded anywhere in application source — they come only from env vars (`OPENAI_VISION_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_RESEARCH_MODEL`, `OPENAI_STYLIST_MODEL`, `OPENAI_PLANNER_MODEL`). AI and data-backed features must fail closed (never fall back to sample/fake data) when their required env vars are missing. See `.env.example` and `src/lib/env/{client,server}.ts`. `SUPABASE_SERVICE_ROLE_KEY`, OpenAI keys, and worker secrets are server-only — never prefix with `NEXT_PUBLIC_`.

## Architecture

### Request boundary

Ordinary routes: browser → protected page → Route Handler → resolve Supabase user → Zod-validate → user-scoped Postgres/RLS operation → deterministic service or authenticated tool → typed/streamed response. The browser never sees the Supabase service-role key or an OpenAI key.

Expensive/long-running work (image import, product research, storage cleanup) is **not** tied to one request. It is a durable row in Postgres, leased by a worker (`FOR UPDATE SKIP LOCKED`) via `src/jobs/*`, hitting internal routes under `src/app/api/internal/*` (secured with `IMPORT_WORKER_SECRET`). Interactive routes can also process one _owned_ job for convenience, but production should rely on a scheduler calling those internal routes.

### Layers (`src/`)

- `app`: layouts/pages and Route Handlers (`app/api/**`). `app/api/_lib` holds shared route schema/response helpers.
- `features/*`: per-feature types, Zod schemas, hooks, and components (auth, wardrobe, intake/import, research, stylist, planner, outfits, insights, today, settings, weather, uploads).
- `lib/supabase`: browser / server-session / admin (service-role) Supabase clients — pick the least-privileged one that works.
- `lib/auth`: authenticated viewer resolution.
- `lib/image`: decoded-content validation, EXIF stripping, normalization, cropping, thumbnails.
- `lib/recommendation`: hard filters, scoring weights, color/layer compatibility, exact-ID outfit validation, balanced planning — all deterministic, no model calls.
- `lib/weather`: Open-Meteo geocoding/forecast + deterministic clothing constraints.
- `lib/ai`: OpenAI client selection, strict Zod schemas, prompts, and the agents in `lib/ai/agents/*` (orchestrator, cataloging, stylist, planner, research).
- `lib/compilation`: precomputed wardrobe/outfit-candidate generation consumed by the stylist path.
- `jobs`: durable processors — `process-import.ts`, `research-item.ts`, `process-storage-deletions.ts`, `compile-wardrobe.ts`.
- `supabase/migrations`: schema, RLS, private Storage policies, transactional RPCs, quota/usage controls, account lifecycle. Three files, applied strictly in order (`202607210001_core_wardrobe_imports.sql`, `...0002_outfits_agents_operations.sql`, `...0003_security_storage_account.sql`). Every table enables RLS in the migration that creates it, so a partially-applied schema stays deny-by-default.

### AI agents (`src/lib/ai/agents`)

Model calls are narrow and orchestrated, not free-roaming:

- **Orchestrator** classifies the request, gathers preferences/weather/owned candidates, and only then calls the stylist. It has no unrestricted DB access. Its result is rejected unless every item is in the supplied candidate set, owned by the caller, active/undeleted/available, matches its declared role, and forms a valid foundation (exactly one dress, or exactly one top + one bottom).
- **Cataloging agent**: one Responses API call detects garments in an image, returns strict structured fields + per-field confidence. Never infers an exact brand from appearance alone.
- **Image extraction service** (`lib/ai/image-service.ts`): model output + deterministic post-processing (chroma background removal, color-distance cleanup, framing checks, bounded regeneration, explicit user approval).
- **Research agent**: only runs on request; uses user-confirmed clues + OpenAI web search; results are proposals with evidence and a confidence tier (`verified | likely | uncertain | not_found`) until explicitly accepted via RPC. Cannot overwrite user-confirmed fields.
- **Stylist agent**: gets compact metadata for an already-filtered candidate set (never the whole wardrobe/raw images); returns exact candidate IDs + explanation + confidence. Hard rules (ownership, availability, weather, foundation, roles) are enforced deterministically outside the model, not trusted from its output.
- **Planner agent**: one unique look per requested date, laundry/availability/forecast aware; every returned day is re-validated before save.

AI output is always a _proposal_ — never silently written as final item metadata. User confirmation / explicit accept-RPCs are the only path to persisted truth. `agent_runs`/`messages` store safe summaries only: no hidden chain-of-thought, no API secrets, no raw private image bytes.

### Data flow: photo import

Route allocates `import_jobs` row + signed upload path → browser uploads directly to private bucket → worker leases job, validates/normalizes/strips EXIF, analyzes once → each detected garment becomes an `import_job_candidates` row with crop + AI confidence → user reviews/corrects crop, extraction, metadata → `confirm_import_job(job_id)` creates wardrobe items + image lineage in one transaction (idempotent retry returns same item IDs) → approved derivatives are promoted to item-prefixed private paths idempotently.

### Data flow: styling

Resolve user/preferences/date/location/candidates → forecast → deterministic constraints → filter out archived/deleted/unavailable/laundry/weather-incompatible items → score remaining candidates with centrally configured weights → stylist gets compact exact-ID candidate set → validate result against ownership/availability/role/foundation rules → optionally persist via transactional RPC (`save_generated_outfit`, `save_generated_plan`, `save_generated_week`, etc.).

## Data model essentials (see `docs/data-model.md` for full detail)

- `profiles.id` is exactly the Supabase Auth user ID; deleting the Auth user cascades through virtually everything except `storage_deletion_queue`, which intentionally retains the former user UUID until a worker removes the underlying bytes.
- Every user-owned table has `user_id`; junction tables use **composite** foreign keys (e.g. `(item_id, user_id)`) so a service-role bug can't link one user's row to another user's.
- Mutations for anything expensive or state-machine-like go through **RPCs**, not direct client inserts/updates: `enqueue_import_job`, `claim_import_job(s)`, `claim_owned_import_job`, `confirm_import_job`, `enqueue_research_run`, `accept_research_run`/`reject_research_run`, `save_generated_outfit`/`save_generated_plan`/`save_generated_week`, `create_user_outfit`, `swap_outfit_item`, `mark_outfit_worn`/`mark_wardrobe_item_worn`. These RPCs own quota consumption, ownership checks, and idempotency — don't bypass them with raw table writes.
- Quotas: `feature_limits` (server-owned daily budgets for import/research, no client access) + `feature_usage_counters`/`consume_rate_limit` for rate limiting. Exhaustion surfaces as PostgREST HTTP 429 (`PT429`) with `limit`/`used`/`remaining`/`reset_at` in `details`.
- Import job states: `queued → analyzing → review_crop → extracting → review_metadata [→ researching] → complete` (any active state can go `failed`/`cancelled`). Candidate states are the analogous per-garment chain ending in `approved`/`rejected`/`failed`.

## Storage & security (see `docs/storage-security.md`, `docs/privacy.md`)

- Five private buckets, all path-scoped `{userId}/...` and enforced by Storage RLS (`auth.uid()` must equal the first path segment): `wardrobe-originals`, `wardrobe-items`, `wardrobe-labels`, `wardrobe-generated`, `profile-references`.
- Never trust a client-provided `userId`, path, extension, MIME type, `itemId`, or `jobId` — server code constructs the path itself after resolving the authenticated user.
- Buckets stay private; never flip them public. Generate short-lived signed URLs on authenticated server routes only, and only after verifying the DB row belongs to the caller. Persist `{bucket_id, storage_path}`, not signed URLs.
- Server upload contract before accepting any image: decode + validate real format/dimensions/pixel count, normalize orientation/color space, strip EXIF/location metadata, reject decompression bombs.
- Use the Storage API for deletion, never raw SQL on `storage.objects`. Hard-deleting an image/import row enqueues its path into `storage_deletion_queue`; a service-role worker drains that queue (`claim_storage_deletion_tasks`).
- `agent_runs` is authenticated `SELECT`-only; only server/service-role code with an independently-resolved viewer may insert into it.

## Testing conventions

- Unit tests: Vitest + jsdom, files under `tests/unit/*.test.ts` plus a couple of top-level `tests/*.test.ts`. `tests/setup.ts` is the global setup; `tests/unit/fixtures.ts` holds shared fixtures. Path alias `@` → `src`.
- E2E: Playwright, `tests/e2e/*.spec.ts`, chromium + mobile projects, dev server auto-started against `http://127.0.0.1:3000`.
- The `.agents/skills/*` directory (`import-clothes`, `generate-outfits`) contains **development-time automation instructions for the legacy local-JSON workflow** — unrelated to the runtime agents in `src/lib/ai/agents`. Don't confuse the two when asked about "agents."
