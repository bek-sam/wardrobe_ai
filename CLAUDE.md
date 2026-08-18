# CLAUDE.md

Wardrobe AI is a privacy-sensitive clothing assistant implemented as four
independently deployable workloads in one monorepo. Root `src/` is Frontend.
`backend/`, `worker/`, and `ai-orchestration/` are separate projects that
communicate only through network contracts. `database/` owns Supabase assets;
`contracts/` owns transport types. `legacy/` is reference-only.

## Non-negotiable ownership

- **Frontend (`src/`)**: pages, components, accessibility, browser state, SSR
  presentation, and Backend HTTP clients. No Route Handlers, database/provider
  SDKs, business authorization, jobs, or secrets.
- **Backend (`backend/`)**: public API, Supabase session/cookie boundary,
  authorization, validation, quotas, business use cases, signed uploads,
  deterministic algorithms, and weather access. No React UI, OpenAI SDK, model
  prompts, or durable job execution.
- **Worker (`worker/`)**: claims, leases, retries, heartbeats, idempotent durable
  handlers, and storage/media processing. No public browser API, React, OpenAI
  SDK, or provider prompt policy.
- **AI Orchestration (`ai-orchestration/`)**: authenticated allow-listed model
  tasks, prompt construction, provider schemas/adapters, and model policy. No
  product database, user sessions, or business writes.
- **Database (`database/supabase/`)**: immutable migrations, RLS, Auth/Storage
  policy, transactions, queue truth, and atomic RPCs.
- **Contracts (`contracts/`)**: versioned DTOs and private task/event envelopes;
  no framework or business implementation.

Never add a source import across deployable boundaries. A local development
shortcut must still use HTTP because deployment uses HTTP. Shared contracts may
be imported from `@wardrobe/contracts`.

## Security

- Frontend may receive only browser-safe configuration. Do not put database
  credentials, service/secret keys, workload tokens, provider keys, model IDs,
  prompts, private object paths, or signed URLs into source, logs, public env, or
  browser bundles.
- Supabase service credentials are Backend/Worker-only. OpenAI credentials and
  model IDs are AI-Orchestration-only. `AI_SERVICE_TOKEN` is private workload
  authentication for Backend/Worker → AI Orchestration.
- Authenticate, authorize ownership, validate bounded input, apply quotas, and
  use idempotency before side effects. Treat all model output as untrusted.
- Preserve RLS and database constraints as defense in depth. Never weaken them
  to make a test or service call pass.
- Do not log raw prompts, images, auth/session values, signed URLs, secret
  headers, precise location, or private Storage paths.
- Keep private AI Orchestration off the public network. Unknown tasks return
  not-found; expired deadlines fail before provider work.

## Runtime and scale

- Frontend and Backend are stateless standalone Next deployments. Do not use
  process memory or local files as durable/cache truth across requests.
- Durable handlers live only in Worker. Claims use database row locks/leases,
  bounded attempts, backoff, and idempotent finalization. Multiple replicas must
  safely process different jobs.
- `WORKER_CONCURRENCY` is bounded per replica; add replicas for horizontal scale
  and raise concurrency only after observing database/provider limits.
- HTTP calls need explicit deadlines and typed errors. Maintain compatibility
  with the previous contract/database shape during rolling deployment.
- AI proposes. Deterministic validation and database transactions decide what
  is persisted.

## Source organization

Inside an owner, group by product capability: account, catalog, intake,
research, context, style engine, looks/planning, studio, insights, and platform.
Framework-mandated entry points may stay small. Combine implementation files
that change and test together; split at security, contract, durable-retry,
framework, or genuinely reusable domain seams.

There is **no line-count rule** and no requirement that every file exceed 50
lines. Do not pad files or merge unrelated responsibilities to satisfy a number.
Use `npm run audit:consolidation` to review the distribution, not enforce size.

## Working rules

- Preserve user changes in this dirty worktree; do not reset or overwrite
  unrelated work.
- Use `rg`/`rg --files` for search and `apply_patch` for hand edits.
- Never edit an applied migration. Add a new ordered migration.
- Do not wire production code to `legacy/` or its JSON data.
- Do not add fake/sample user data as a production fallback. Provider-backed
  features fail closed with typed errors when required configuration is absent.
- Keep route handlers thin: authenticate, parse, call a use case, map the typed
  response. Long-running routes enqueue and return status.
- Do not expose hidden chain-of-thought. Store only safe summaries and bounded
  observability fields.

## Commands

```bash
npm run dev                    # Frontend :3000, Backend :3001, AI :3002, Worker
npm run check:architecture     # dependency cycles + owner boundaries + audit
npm run typecheck              # Frontend
npm test                       # Frontend unit/presentation tests
npm run architecture:typecheck
npm run architecture:test
npm run build
npm run architecture:build
npm run check:quality          # all static, unit, and build gates
npm run test:integration       # requires local Supabase
npm run test:e2e               # requires local Supabase + Chromium
npm run check                  # complete quality + integration + E2E
```

Local database:

```bash
npx supabase start --workdir database
npx supabase db reset --workdir database
```

Before handoff, run verification proportionate to the change. Boundary or
deployment changes require `check:architecture`, every project typecheck/test,
and every production build. Passing `check:quality` does not imply integration
or E2E ran.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
