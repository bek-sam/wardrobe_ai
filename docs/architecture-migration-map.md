# Architecture migration map

Status: complete  
Completed: 2026-08-14

The codebase has been physically migrated into independently buildable owners.
This file records the completed source mapping and the checks that prevent the
old mixed layout from returning.

| Previous mixed responsibility                                                            | Current owner           |
| ---------------------------------------------------------------------------------------- | ----------------------- |
| root pages/components/features                                                           | root `src/` Frontend    |
| root Route Handlers, auth callbacks, server auth, database adapters, business algorithms | `backend/src/`          |
| root import/research/compilation/preview/visualization/deletion processors               | `worker/src/`           |
| root/worker provider clients, prompts, model schemas and visualization provider logic    | `ai-orchestration/src/` |
| root `supabase/`                                                                         | `database/supabase/`    |
| shared transport/job types                                                               | `contracts/src/`        |
| container/topology assets                                                                | `infrastructure/`       |
| old Vite UI and JSON workflow                                                            | `legacy/`               |

The redundant `frontend/` project was removed; root `src/` is the Frontend.
Frontend no longer owns `app/api`, `app/auth` callback handlers, jobs, Supabase
clients, provider clients, or server credentials. Backend owns the public API
and auth boundary. All six durable families run only in Worker. All provider
calls and prompts run only in AI Orchestration.

## Completion evidence

- Each runtime has its own package, TypeScript configuration, tests, build, and
  process entry point.
- Frontend and Backend use HTTP even locally. Backend/Worker use authenticated
  private HTTP for AI tasks.
- Database queues, leases, attempts, backoff, and idempotency survive process
  crashes and support multiple Worker replicas.
- Docker build targets contain independent runtime artifacts; AI Orchestration
  is private and Worker publishes no port.
- `scripts/check-project-boundaries.mjs` rejects duplicate/mixed ownership,
  cross-project implementation imports, and sensitive dependencies in
  Frontend.
- `scripts/architecture-audit.mjs` rejects unresolved internal imports and
  cycles. `scripts/source-consolidation-audit.mjs` inventories organization
  without enforcing an arbitrary line count.

## Compatibility policy after migration

- Public API uses `/api/v1`; compatibility rewrites remain while browser routes
  are incrementally normalized to the explicit version.
- Additive database migrations are never edited after application.
- Rolling releases keep Backend, Worker, AI task, and database contracts
  compatible with the preceding version.
- A feature moves to a new owner only as a complete vertical slice: contract,
  implementation, tests, observability, and old-code removal together.
- Queue rows remain workflow truth. Do not reintroduce internal cron/process
  routes or browser-triggered long-running execution.

See [Architecture](architecture.md) for the current design and
[Deployment](deployment.md) for production topology.
