# Deployment: background workers

Five kinds of durable, expensive work are represented as rows in Postgres and processed by a worker, not tied to one browser request: photo import, product research, private-object storage cleanup, wardrobe compilation, and outfit preview generation. Each has a matching internal Route Handler:

| Work                 | Route                                        | Job table                   |
| -------------------- | -------------------------------------------- | --------------------------- |
| Import               | `POST /api/internal/imports/process`         | `import_jobs`               |
| Research             | `POST /api/internal/research/process`        | `research_runs`             |
| Storage cleanup      | `POST /api/internal/storage/process`         | `storage_deletion_queue`    |
| Wardrobe compilation | `POST /api/internal/wardrobe/process`        | `wardrobe_compilation_jobs` |
| Preview generation   | `POST /api/internal/outfit-previews/process` | `outfit_preview_jobs`       |

All five share the same shape: `FOR UPDATE SKIP LOCKED` batch claim with a lease (`locked_until`), bounded retries with exponential backoff, and a hard `maxDuration` so a stuck invocation can't run forever. None of them are triggered by the browser in production — the interactive routes (e.g. the wardrobe "Recompile" button) opportunistically claim and process **one** job they themselves just created for low latency, but the durable guarantee ("this eventually runs, even if every browser closes") comes entirely from an external scheduler calling these routes on an interval.

Preview generation claims a smaller batch (3 jobs, vs 5 for wardrobe compilation) and re-checks its execution budget before _every_ job in the batch, not just between batches — each job can include several image downloads plus an OpenAI image-generation call, so its per-job duration is far less predictable than the other four workers' (see `src/jobs/generate-outfit-previews/process-batch.ts`).

## Authorization

Every internal route requires `Authorization: Bearer <secret>`, checked with a constant-time comparison. By default all five accept `IMPORT_WORKER_SECRET` (or the more generic `CRON_SECRET` as a fallback). The wardrobe-compilation and preview-generation routes additionally accept their own dedicated secret, checked first, so that worker's credential can be rotated or scoped independently of the others without touching import/research/storage:

```
secret = WARDROBE_COMPILATION_WORKER_SECRET ?? IMPORT_WORKER_SECRET ?? CRON_SECRET
secret = OUTFIT_PREVIEW_WORKER_SECRET ?? WARDROBE_COMPILATION_WORKER_SECRET ?? IMPORT_WORKER_SECRET ?? CRON_SECRET
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
| `OUTFIT_PREVIEW_WORKER_SECRET`                    | optional           | Dedicated preview-generation worker credential; falls back to the shared secrets above when unset.                                                                                                                                                                                                                                   |
| `PREVIEW_DAILY_LIMIT`                             | optional           | Per-user daily cap on modeled preview generations, enforced by the worker before each render. `.env.example` default: 30.                                                                                                                                                                                                            |
| `PREVIEW_MAX_QUEUED_PER_USER`                     | optional           | Caps how many preview jobs one user can have queued/running at once; `enqueue_outfit_preview_job` rejects beyond this. `.env.example` default: 5.                                                                                                                                                                                    |
| `PREVIEW_FREQUENTLY_SUGGESTED_THRESHOLD`          | optional           | `times_suggested` count at which a previewless candidate gets opportunistically queued by the worker's scheduled sweep. `.env.example` default: 3.                                                                                                                                                                                   |
| `PREVIEW_MAX_AUTO_PER_UPLOAD`                     | optional           | Caps how many previews are auto-queued per import batch outside the worker's own sweep. `.env.example` default: 5.                                                                                                                                                                                                                   |

## Scheduling in production

Pick any scheduler capable of an authenticated HTTPS POST on an interval; none of these routes are Vercel/host-specific.

**Recommended cadence:** every 1–2 minutes for wardrobe compilation and import (interactive-feeling latency matters), every 5 minutes for research and storage cleanup (best-effort, lower urgency). Preview generation can also run every 1–2 minutes, though the interactive owned-claim path (`processOwnedOutfitPreviewJob`) already covers the latency-sensitive case, so a 5-minute interval is acceptable if you'd rather conserve invocations. Each call claims a bounded batch of jobs (5 for wardrobe compilation, 3 for preview generation) and processes as many as fit in its execution budget (`EXECUTION_BUDGET_MS` in `src/app/api/internal/wardrobe/process/route.ts` and `src/app/api/internal/outfit-previews/process/run-preview-worker.ts`), so a short interval is safe — an overlapping invocation just claims a disjoint set of jobs via `SKIP LOCKED`.

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
