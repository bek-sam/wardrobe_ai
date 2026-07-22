# Deployment: background workers

Four kinds of durable, expensive work are represented as rows in Postgres and processed by a worker, not tied to one browser request: photo import, product research, private-object storage cleanup, and wardrobe compilation. Each has a matching internal Route Handler:

| Work                 | Route                                 | Job table                   |
| -------------------- | ------------------------------------- | --------------------------- |
| Import               | `POST /api/internal/imports/process`  | `import_jobs`               |
| Research             | `POST /api/internal/research/process` | `research_runs`             |
| Storage cleanup      | `POST /api/internal/storage/process`  | `storage_deletion_queue`    |
| Wardrobe compilation | `POST /api/internal/wardrobe/process` | `wardrobe_compilation_jobs` |

All four share the same shape: `FOR UPDATE SKIP LOCKED` batch claim with a lease (`locked_until`), bounded retries with exponential backoff, and a hard `maxDuration` so a stuck invocation can't run forever. None of them are triggered by the browser in production — the interactive routes (e.g. the wardrobe "Recompile" button) opportunistically claim and process **one** job they themselves just created for low latency, but the durable guarantee ("this eventually runs, even if every browser closes") comes entirely from an external scheduler calling these routes on an interval.

## Authorization

Every internal route requires `Authorization: Bearer <secret>`, checked with a constant-time comparison. By default all four accept `IMPORT_WORKER_SECRET` (or the more generic `CRON_SECRET` as a fallback). The wardrobe-compilation routes additionally accept a dedicated `WARDROBE_COMPILATION_WORKER_SECRET`, checked first, so that worker's credential can be rotated or scoped independently of the others without touching import/research/storage:

```
secret = WARDROBE_COMPILATION_WORKER_SECRET ?? IMPORT_WORKER_SECRET ?? CRON_SECRET
```

Generate any of these with `openssl rand -hex 32`. Never reuse a worker secret as a user-facing credential, and never commit a real value — `.env.example` documents the variable names only.

## Required environment variables

| Variable                                          | Required           | Purpose                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`                       | yes                | Every worker uses the admin (service-role) Supabase client to claim/write jobs across users; RLS intentionally denies this to normal sessions.                                                                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_URL`                        | yes                | Supabase project the admin client connects to.                                                                                                                                                                                                                                                                                       |
| `IMPORT_WORKER_SECRET` and/or `CRON_SECRET`       | yes (at least one) | Shared worker authorization, see above.                                                                                                                                                                                                                                                                                              |
| `WARDROBE_COMPILATION_WORKER_SECRET`              | optional           | Dedicated wardrobe-compilation worker/health credential; falls back to the shared secrets above when unset.                                                                                                                                                                                                                          |
| `WARDROBE_COMPILATION_MAX_CANDIDATES`             | optional           | Hard cap on stored candidates per compilation run. Unset uses a dynamic default (`min(1000, max(20, wardrobe_size * 8))`).                                                                                                                                                                                                           |
| `WARDROBE_COMPILATION_MAX_FOUNDATIONS_PER_BUCKET` | optional           | How many top-ranked foundations per occasion bucket get expanded into variants. Unset defaults to 60.                                                                                                                                                                                                                                |
| `OPENAI_API_KEY`, `OPENAI_STYLIST_MODEL`          | optional           | Only needed for the occasion-resolution AI escalation (`resolveOccasionContextWithEscalation`); wardrobe compilation itself never calls a model. Retrieval/orchestration degrades to deterministic-only occasion matching when unset — it never fails closed, since the deterministic default is a legitimate answer, not fake data. |

## Scheduling in production

Pick any scheduler capable of an authenticated HTTPS POST on an interval; none of these routes are Vercel/host-specific.

**Recommended cadence:** every 1–2 minutes for wardrobe compilation and import (interactive-feeling latency matters), every 5 minutes for research and storage cleanup (best-effort, lower urgency). Each call claims up to 5 jobs and processes as many as fit in its execution budget (`EXECUTION_BUDGET_MS` in `src/app/api/internal/wardrobe/process/route.ts`), so a short interval is safe — an overlapping invocation just claims a disjoint set of jobs via `SKIP LOCKED`.

### Option A: Vercel Cron

Add a `vercel.json` with a `crons` entry per route, e.g.:

```json
{
  "crons": [{ "path": "/api/internal/wardrobe/process", "schedule": "*/2 * * * *" }]
}
```

Vercel Cron invocations are unauthenticated by default (no custom `Authorization` header support), so pair this with `CRON_SECRET` read from the standard `Authorization: Bearer $CRON_SECRET` header Vercel sends on cron-triggered requests, or front the route with a thin authenticated proxy if your plan doesn't support that header.

### Option B: GitHub Actions scheduled workflow

```yaml
name: wardrobe-compilation-worker
on:
  schedule:
    - cron: "*/2 * * * *"
jobs:
  invoke:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sf -X POST "$APP_URL/api/internal/wardrobe/process" \
            -H "Authorization: Bearer $WORKER_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          WORKER_SECRET: ${{ secrets.WARDROBE_COMPILATION_WORKER_SECRET }}
```

GitHub's scheduled-workflow cadence is best-effort (can lag under load), which is acceptable here since a missed tick just means the next one catches up — no work is lost, only delayed.

### Option C: any external cron/uptime service

Any service that can POST with a custom header on an interval (e.g. a hosted cron service, a small VM with `cron` + `curl`) works identically. The only requirements are: HTTPS, the `Authorization: Bearer <secret>` header, and a timeout comfortably above the route's own `maxDuration` (300s) so the caller doesn't retry into an already-running invocation.

## Health/status

`GET /api/internal/wardrobe/health` (same authorization as the process route) returns aggregate queue depth — `queued_jobs`, `running_jobs`, `failed_jobs`, `failed_jobs_last_24h`, `oldest_queued_job_age_seconds` — and nothing else: no job IDs, user IDs, or wardrobe content. Wire it into an uptime/status dashboard and alert on `oldest_queued_job_age_seconds` exceeding a few multiples of your scheduling interval (indicates the scheduler stopped firing or the worker is failing every claim) or a persistently nonzero `failed_jobs_last_24h`.

Import, research, and storage cleanup don't yet have an equivalent `/health` route; the same pattern (aggregate counts from their job tables, same authorization) extends directly if that's needed later.
