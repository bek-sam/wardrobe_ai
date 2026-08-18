# Deployment

Wardrobe AI ships four independent workloads plus one managed Supabase project.
Do not deploy the repository root as one container.

## Production topology

| Workload         | Exposure                                           | Scale unit                                       | Required private configuration                                                             |
| ---------------- | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Frontend         | public edge                                        | stateless HTTP replica                           | `BACKEND_URL`; browser-safe `NEXT_PUBLIC_*` only                                           |
| Backend          | public only through edge `/api` and auth callbacks | stateless HTTP replica                           | Supabase server credentials, auth secrets, AI workload token, weather/storage/quota policy |
| Worker           | no public port                                     | continuous process replica + bounded concurrency | Supabase server credential, AI workload token, job/media policy                            |
| AI Orchestration | private network only                               | stateless HTTP replica                           | AI workload token, OpenAI key/model policy                                                 |
| Supabase         | platform endpoints as required                     | managed database/Auth/Storage                    | schema, RLS, private bucket policy                                                         |

Use the Dockerfiles under `infrastructure/docker/` as separate build targets.
Both Next workloads use `output: "standalone"`. The Frontend image contains the
Frontend bundle only; it does not receive Backend, Worker, database migration,
or AI source.

At the edge:

- route pages/assets to Frontend;
- route `/api/*` and `/auth/callback/*` to Backend, preserving cookies, origin,
  request IDs, streaming, and response headers;
- never route Worker or AI Orchestration publicly;
- set proxy body/time limits consciously for signed-upload negotiation and SSE;
- drain an instance before termination rather than cutting active requests.

## Secrets and configuration

Use a secret manager and distinct workload identities. Never build secrets into
images or inject a single shared environment into every workload in production.
The local Compose `env_file` is convenience only; production must inject
per-service variables.

| Variable group                    | Frontend | Backend | Worker |  AI |
| --------------------------------- | -------: | ------: | -----: | --: |
| `NEXT_PUBLIC_*`, `BACKEND_URL`    |      yes |      no |     no |  no |
| Supabase URL/publishable key      |       no |     yes |     no |  no |
| Supabase secret/service role      |       no |     yes |    yes |  no |
| auth action/rate-limit secrets    |       no |     yes |     no |  no |
| `AI_SERVICE_TOKEN`                |       no |     yes |    yes | yes |
| OpenAI key/models/provider policy |       no |      no |     no | yes |
| Worker concurrency/job policy     |       no |      no |    yes |  no |

Prefer a different Supabase secret key per trusted workload so one compromise
can be rotated independently. Privileged Supabase keys bypass RLS; Backend and
Worker must still validate ownership explicitly. Move away from legacy
`service_role` JWT keys when all required Supabase tooling supports newer
secret keys.

## Scaling

### Frontend and Backend

Both are stateless. Add replicas behind a load balancer for horizontal scale.
Do not store sessions, idempotency, queues, or correctness-critical cache state
in process memory or a local filesystem. If Next server cache is enabled across
multiple instances, configure shared cache coordination or disable behavior
that cannot tolerate per-instance divergence.

Scale vertically when profiles show CPU/memory saturation in a single request;
scale horizontally for throughput and availability. Observe database connection
pressure when increasing Backend replicas.

### Worker

Every replica runs the same dispatcher or a subset selected by
`WORKER_ENABLED_FAMILIES`. PostgreSQL claim RPCs use `FOR UPDATE SKIP LOCKED`,
leases, and bounded batches, so replicas do not intentionally claim the same
row. Expired leases recover crashed work.

- horizontal: add Worker replicas;
- vertical: raise `WORKER_CONCURRENCY` gradually (allowed range 1–6);
- isolate a heavy family with a narrower enabled-family list;
- autoscale on oldest-ready-job age and queue depth, not CPU alone;
- cap scale at database, Storage, memory, and provider concurrency limits.

Worker shutdown handles `SIGTERM`/`SIGINT`, stops claiming new work, and gives
in-flight handlers a drain window. A hard stop remains recoverable through the
lease, so handlers must stay idempotent.

### AI Orchestration

AI Orchestration is stateless and can scale separately. Apply provider
concurrency/rate/cost control at this layer. Authenticate every call with the
workload token, honor `x-deadline-at`, bound request bodies/input shape, and
return typed failures without leaking provider detail.

## Database release sequence

1. Back up and test the migration on a production-like database.
2. Apply additive migrations from `database/supabase/migrations` in order.
3. Deploy backward-compatible AI Orchestration and Worker changes.
4. Deploy Backend, then Frontend.
5. Observe error rate, queue age/retries, database locks/connections, provider
   latency/cost, and p95/p99 request latency.
6. Remove compatibility code only after all old replicas are gone.

Never edit an applied migration. A rolling release must tolerate both the
preceding and new contract/schema until every replica has advanced.

## Health and readiness

- Frontend: page/asset readiness plus Backend dependency telemetry.
- Backend: `GET /api/v1/health`; readiness fails when it cannot safely accept
  work, while short provider degradation is surfaced separately.
- AI Orchestration: `GET /internal/v1/health` on the private network.
- Worker: process liveness plus alerts on heartbeat, queue age, lease expiry,
  retry rate, and terminal failures.
- Supabase: connection/transaction latency, lock waits, Storage error rate, and
  migration version.

Propagate `x-request-id`/W3C trace context across edge → Frontend → Backend →
job → Worker → AI, while keeping raw prompts, images, signed URLs, object paths,
session values, and secrets out of telemetry.

## Local production parity

```bash
cp .env.example .env.local
docker compose --env-file .env.local -f infrastructure/local/compose.yaml up --build
docker compose --env-file .env.local -f infrastructure/local/compose.yaml up --scale worker=3
```

The Compose private network publishes no AI or Worker host port. For routine
source development, `npm run dev` starts the same four processes using the same
network protocols.

## Release gates

```bash
npm run check:quality
npx supabase start --workdir database
npx supabase db reset --workdir database
npm run test:integration
npm run test:e2e -- --project=chromium
```

Also scan the built Frontend artifact for credential names/values, validate
container contents and non-root/read-only execution, exercise a multi-replica
Worker crash/lease-recovery scenario, and verify account export/deletion on a
disposable production-like user before a private beta.
