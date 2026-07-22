# Architecture

Wardrobe AI is one strict TypeScript Next.js App Router application with server-rendered pages, Route Handlers, authenticated Supabase access, deterministic recommendation logic, and bounded OpenAI calls. Long-running work is represented in PostgreSQL rather than being tied to one browser request.

## Request boundaries

```text
browser
  ├─ public/auth pages
  └─ protected application pages
       └─ Next.js Route Handler
            ├─ resolve Supabase user
            ├─ validate with Zod
            ├─ user-scoped PostgreSQL/RLS operation
            ├─ deterministic service or authenticated tool
            └─ typed response / user-visible stream

durable worker
  └─ lease queued job with service role
       ├─ decode/normalize private image or clues
       ├─ call bounded OpenAI operation
       ├─ persist reviewable proposal and safe trace
       └─ release as review, retry, or terminal failure
```

The browser never receives the Supabase service-role key or OpenAI key. Ordinary application routes use the user session and RLS. Service-role access is limited to background work, Storage administration, account cleanup, and operations that cannot be expressed through user RLS.

## Application layers

- `src/app`: layouts, pages, and HTTP route handlers.
- `src/features`: feature types, schemas, hooks, and components.
- `src/lib/supabase`: browser, server-session, and admin clients.
- `src/lib/auth`: authenticated viewer resolution.
- `src/lib/image`: decoded-content validation, normalization, cropping, cleanup, and thumbnails.
- `src/lib/recommendation`: hard filters, configurable scoring, color/layer compatibility, exact-ID validation, and balanced planning.
- `src/lib/weather`: Open-Meteo geocoding, forecasts, caching, and clothing constraints.
- `src/lib/ai`: environment-selected OpenAI clients, strict schemas, prompts, agents, and authenticated tools.
- `src/lib/compilation`: bounded, deterministic outfit-candidate generation for the precomputed library (weights/diversity, no model calls).
- `src/jobs`: durable import, research, wardrobe-compilation, and private-object cleanup processors.
- `supabase/migrations`: schema, RLS, private Storage, transactional RPCs, usage controls, and account lifecycle.

## Data flow: photo import

1. An authenticated route allocates an owned `import_jobs` row and signed private upload path.
2. The browser uploads directly to the private originals bucket.
3. A worker leases the job, validates decoded bytes, normalizes orientation/color, removes metadata, and analyzes the image once.
4. Each detected garment becomes a durable candidate with a crop and field-level AI confidence.
5. The user approves/corrects the crop, extraction, and proposed metadata.
6. Confirmation creates owned wardrobe records and image lineage in one PostgreSQL transaction. A retry returns the same item IDs.
7. Approved derivatives are promoted to item-prefixed private paths idempotently; immutable source lineage remains available for audit/retry.

AI never silently writes the final item metadata. Confirmation merges only reviewable proposals and user edits.

## Data flow: styling

1. Resolve the authenticated user, preferences, requested date/location, and candidate wardrobe rows.
2. Convert forecast data into deterministic constraints.
3. Remove archived, deleted, unavailable, laundry, and weather-incompatible items.
4. Score the remaining candidates with centrally configured weights.
5. Give the stylist a compact candidate set of exact owned IDs and structured metadata.
6. Validate its structured result against ownership, availability, role, and outfit-foundation rules.
7. Optionally save through a transactional database RPC.

A valid foundation is exactly one dress or exactly one top plus one bottom. A dress cannot be combined with a top or bottom. Optional layer, shoes, and accessory roles are unique.

## Data flow: precomputed outfit-candidate library

A durable, debounced `wardrobe_compilation_jobs` row (queued by a trigger on relevant `wardrobe_items` changes, or by `request_wardrobe_recompilation()` for a manual "Recompile") is leased — by the interactive route for low-latency processing, or by the scheduler-driven `POST /api/internal/wardrobe/process` worker — and run through `compileWardrobeForUser`:

1. Load the user's active/available wardrobe and style/feedback preferences.
2. `generateOutfitCandidates` greedily fills each foundation's roles per normalized occasion category (`src/lib/recommendation/occasion-context.ts`), expanding a small bounded set of layer/footwear/accessory variants and tagging aggregate weather coverage — never an unbounded Cartesian product.
3. Every candidate for a fresh `compiled_wardrobe_version` is inserted **alongside** any still-active prior version (never a delete-then-insert).
4. `finalize_wardrobe_compilation()` atomically verifies the new version's row count, flips `wardrobe_compilation_state`'s published-version pointer, archives the prior version, and compare-and-swaps the dirty-change counter — publishing a version that ends up slightly stale (a wardrobe edit landed mid-run) is still safe, since retrieval re-validates item ownership/availability per request; it simply queues a follow-up job.

Live retrieval (`retrieveStoredOutfitCandidates`) prefilters a wide pool by the request's resolved occasion category, live-scores/hard-filters it against current weather and preferences, and returns up to three ranked, deduplicated alternatives (safest, underused, expressive) instead of one. The orchestrator only falls back to full LLM composition when nothing in the library clears the confidence bar; exposure counting and fallback-candidate growth are atomic RPCs invoked through Next's `after()` so they run post-response without an untracked background promise.

## Reliability

- Import, research, storage-cleanup, and wardrobe-compilation state, attempts, lease times, and errors are persisted.
- Worker claims use `FOR UPDATE SKIP LOCKED`; failed jobs retry with capped exponential backoff up to a fixed attempt limit before landing in a terminal `retry_exhausted`/dead-letter state.
- Garment candidate IDs are deterministic per job/ordinal.
- Save, swap, wear, research-acceptance, and plan operations use transactional RPCs.
- Idempotency and feature-usage tables support retry safety and cost controls.
- Agent logs contain safe summaries and usage, not image bytes, secrets, or hidden reasoning.
- Weather failure degrades to occasion/preference styling instead of blocking a recommendation.
- See `docs/deployment.md` for how the internal worker routes get scheduled in production, their required environment variables, and the wardrobe-compilation worker's `/health` endpoint.

## Legacy boundary

Vite and the local JSON importer remain behind `legacy:*` scripts during parity review. Production Next.js code does not read `data/library.json`, depend on a global model-reference photo, or register the old cache-first service worker.
